import * as fs from 'fs'
import { parse as parseToml, stringify as stringifyToml } from '@iarna/toml'
import type { ApiBackend, Provider } from '../tool-manager.types.js'
import type { WriteOptions } from '../tool-manager.types.js'
import { getGrokConfigPath, getGrokDir } from '../paths.js'
import { createAtomicTempPath, ensureDir, fileExists } from '../utils/file.js'
import { validateGrokProvider } from '../grok-provider.js'

interface GrokModelsConfig {
  default?: string
  [key: string]: unknown
}

interface GrokModelConfig {
  model?: string
  base_url?: string
  name?: string
  description?: string
  api_key?: string
  env_key?: string
  api_backend?: ApiBackend
  supports_backend_search?: boolean
  [key: string]: unknown
}

interface GrokConfig {
  models?: GrokModelsConfig
  model?: Record<string, GrokModelConfig>
  [key: string]: unknown
}

const DEFAULT_API_BACKEND: ApiBackend = 'chat_completions'
const API_BACKENDS: ApiBackend[] = ['chat_completions', 'responses', 'messages']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function loadExistingConfig(configPath: string): GrokConfig {
  if (!fileExists(configPath)) return {}

  try {
    return parseToml(fs.readFileSync(configPath, 'utf-8')) as GrokConfig
  } catch {
    throw new Error('无法解析现有 Grok config.toml，已中止切换以避免覆盖')
  }
}

function isApiBackend(value: unknown): value is ApiBackend {
  return API_BACKENDS.includes(value as ApiBackend)
}

function resolveApiBackend(value: ApiBackend | undefined, existingValue: unknown): ApiBackend {
  if (value === undefined) {
    return isApiBackend(existingValue) ? existingValue : DEFAULT_API_BACKEND
  }
  if (!API_BACKENDS.includes(value)) {
    throw new Error(`不支持的 Grok API backend: ${String(value)}`)
  }
  return value
}

function buildManagedModel(
  provider: Provider,
  existingModel: GrokModelConfig | undefined
): GrokModelConfig {
  const nextModel: GrokModelConfig = {
    ...(existingModel || {}),
    model: provider.model!.trim(),
    base_url: provider.baseUrl,
    name: provider.name,
    api_backend: resolveApiBackend(provider.apiBackend, existingModel?.api_backend),
    supports_backend_search:
      provider.supportsBackendSearch ??
      (typeof existingModel?.supports_backend_search === 'boolean'
        ? existingModel.supports_backend_search
        : false),
  }

  const description = provider.desc?.trim()
  if (description) {
    nextModel.description = description
  } else {
    delete nextModel.description
  }

  const apiKey = provider.apiKey.trim()
  if (apiKey) {
    nextModel.api_key = apiKey
    delete nextModel.env_key
  } else {
    delete nextModel.api_key
  }

  return nextModel
}

function getConfigTables(config: GrokConfig): {
  models: GrokModelsConfig
  model: Record<string, GrokModelConfig>
} {
  if (config.models !== undefined && !isRecord(config.models)) {
    throw new Error('现有 Grok config.toml 的 models 必须是 table，已中止写入')
  }
  if (config.model !== undefined && !isRecord(config.model)) {
    throw new Error('现有 Grok config.toml 的 model 必须是 table，已中止写入')
  }

  return {
    models: config.models ? { ...config.models } : {},
    model: config.model ? { ...config.model } : {},
  }
}

function writeConfigAtomically(configPath: string, config: GrokConfig): void {
  const tempPath = createAtomicTempPath(configPath)

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content = stringifyToml(config as any)
    fs.writeFileSync(tempPath, content, { mode: 0o600 })
    fs.renameSync(tempPath, configPath)
    fs.chmodSync(configPath, 0o600)
  } catch {
    if (fileExists(tempPath)) {
      try {
        fs.unlinkSync(tempPath)
      } catch {
        // Preserve the original write failure.
      }
    }
    throw new Error('写入 Grok config.toml 失败')
  }
}

/**
 * 将 Provider 安全写入 xAI 官方 Grok Build 用户配置。
 *
 * 自定义 provider 的 merge 模式只更新稳定 alias 和 models.default，overwrite
 * 只重置 models/model；内置 provider 始终只选择 catalog model 并清理旧受管 alias。
 */
export function writeGrokConfig(provider: Provider, options: WriteOptions = {}): void {
  if (!provider.id || !provider.id.trim()) {
    throw new Error('Grok provider ID 不能为空')
  }
  validateGrokProvider(provider)

  ensureDir(getGrokDir())

  const configPath = getGrokConfigPath()
  const existingConfig = loadExistingConfig(configPath)
  const alias = provider.id
  const { models: existingModels, model: existingModelTable } = getConfigTables(existingConfig)
  if (existingModelTable[alias] !== undefined && !isRecord(existingModelTable[alias])) {
    throw new Error(`现有 Grok model alias "${alias}" 必须是 table，已中止写入`)
  }
  const existingTarget = existingModelTable[alias]

  if (!provider.baseUrl) {
    const nextModelTable = { ...existingModelTable }
    delete nextModelTable[alias]
    const nextConfig: GrokConfig = {
      ...existingConfig,
      models: {
        ...existingModels,
        default: provider.model!.trim(),
      },
    }
    if (Object.keys(nextModelTable).length > 0) {
      nextConfig.model = nextModelTable
    } else {
      delete nextConfig.model
    }
    writeConfigAtomically(configPath, nextConfig)
    return
  }

  const managedModel = buildManagedModel(
    provider,
    options.mode === 'overwrite' ? undefined : existingTarget
  )

  const nextConfig: GrokConfig = {
    ...existingConfig,
    models:
      options.mode === 'overwrite'
        ? { default: alias }
        : {
            ...existingModels,
            default: alias,
          },
    model:
      options.mode === 'overwrite'
        ? { [alias]: managedModel }
        : {
            ...existingModelTable,
            [alias]: managedModel,
          },
  }

  writeConfigAtomically(configPath, nextConfig)
}

/**
 * 删除 AnyAI Tools 管理的 Grok model alias。
 * 如果它也是默认模型，则同时移除 models.default。
 */
export function removeGrokConfig(provider: Provider, isCurrent = true): void {
  const configPath = getGrokConfigPath()
  if (!fileExists(configPath)) return

  const existingConfig = loadExistingConfig(configPath)
  const { models, model } = getConfigTables(existingConfig)
  const builtinModel = !provider.baseUrl ? provider.model?.trim() : undefined
  let changed = false

  if (provider.id in model && provider.id !== builtinModel) {
    delete model[provider.id]
    changed = true
  }
  if (
    models.default === provider.id ||
    (isCurrent && builtinModel && models.default === builtinModel)
  ) {
    delete models.default
    changed = true
  }
  if (!changed) return

  const nextConfig: GrokConfig = {
    ...existingConfig,
    models,
  }
  if (Object.keys(model).length > 0) {
    nextConfig.model = model
  } else {
    delete nextConfig.model
  }
  writeConfigAtomically(configPath, nextConfig)
}
