import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import type { Provider } from '../tool-manager.js'
import type { WriteOptions } from '../tool-manager.types.js'
import { getOpenCodeConfigPath, getOpenCodeDir } from '../paths.js'
import { ensureDir, fileExists, readJSON, writeJSON } from '../utils/file.js'
import { replaceVariables, deepMerge } from '../utils/template.js'
import {
  resolveProviderModel,
  resolveProviderParameters,
  resolveProviderReasoning,
  resolveProviderVariant,
} from '../model-config.js'

const OPENCODE_SCHEMA = 'https://opencode.ai/config.json'
const OPENCODE_PROVIDER_KEY = 'openai'
const OPENCODE_MODEL = 'openai/gpt-5.5'
const OPENCODE_MODEL_KEY = 'gpt-5.5'
const DEPRECATED_MANAGED_MODEL_KEYS = ['gpt-5.4', 'gpt-5.3-codex', 'gpt-5.2-codex']

interface OpenCodeProviderOptions {
  baseURL?: string
  apiKey?: string
  [key: string]: unknown
}

interface OpenCodeProvider {
  options?: OpenCodeProviderOptions
  models?: Record<string, unknown>
  [key: string]: unknown
}

interface OpenCodeConfig {
  $schema?: string
  model?: string
  agent?: Record<string, unknown>
  provider?: Record<string, OpenCodeProvider>
  [key: string]: unknown
}

interface OpenCodeProviderMeta {
  npm?: string // legacy: previous versions stored npm package in Provider.model
  models?: Record<string, unknown>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// ESM 环境下获取当前文件所在目录
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function resolveTemplatePath(relativePath: string): string | null {
  const candidates = [
    // @anyaitools/core runtime (dist/writers -> templates)
    path.resolve(__dirname, '../../templates', relativePath),
    // Bundled CLI runtime (dist -> dist/templates)
    path.resolve(__dirname, 'templates', relativePath),
    // Fallback (some bundlers/layouts)
    path.resolve(__dirname, '../templates', relativePath),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }

  return null
}

const DEFAULT_MODELS: Record<string, unknown> = {
  [OPENCODE_MODEL_KEY]: {
    name: 'GPT-5.5',
    options: {
      store: false,
    },
    variants: {
      low: {},
      medium: {},
      high: {},
      xhigh: {},
    },
  },
}

const OPENCODE_CONFIG_TEMPLATE: OpenCodeConfig = {
  provider: {
    [OPENCODE_PROVIDER_KEY]: {
      options: {
        baseURL: '{{baseUrl}}',
        apiKey: '{{apiKey}}',
      },
      models: DEFAULT_MODELS,
    },
  },
  agent: {
    build: {
      options: {
        store: false,
      },
    },
    plan: {
      options: {
        store: false,
      },
    },
  },
  $schema: OPENCODE_SCHEMA,
  model: OPENCODE_MODEL,
}

function loadOpenCodeTemplateConfig(): OpenCodeConfig {
  try {
    const templatePath = resolveTemplatePath('opencode/opencode.json')
    if (templatePath) {
      const content = fs.readFileSync(templatePath, 'utf-8')
      const parsed = JSON.parse(content)
      if (parsed && typeof parsed === 'object') {
        return parsed as OpenCodeConfig
      }
    }
  } catch {
    // 忽略错误，使用内置默认模板
  }
  return OPENCODE_CONFIG_TEMPLATE
}

function parseProviderMeta(raw?: string): OpenCodeProviderMeta | null {
  if (!raw || !raw.trim()) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return parsed as OpenCodeProviderMeta
    }
  } catch {
    // 兼容旧值：如果不是 JSON，则尝试当作 npm 包名
    return { npm: raw }
  }
  return null
}

function enforceAgentStoreFalse(agent: unknown): Record<string, unknown> {
  const base = agent && typeof agent === 'object' && !Array.isArray(agent) ? (agent as any) : {}

  return deepMerge<Record<string, unknown>>(base, {
    build: {
      options: {
        store: false,
      },
    },
    plan: {
      options: {
        store: false,
      },
    },
  })
}

function enforceModelStoreFalse(
  models: unknown,
  options: {
    removeDeprecatedManaged?: boolean
    selectedModelKey?: string
    selectedVariant?: string
    reasoningEffort?: string
  } = {}
): Record<string, unknown> {
  const base = models && typeof models === 'object' && !Array.isArray(models) ? (models as any) : {}
  const mergedModels = deepMerge<Record<string, unknown>>(DEFAULT_MODELS, base)

  if (options.removeDeprecatedManaged !== false) {
    for (const key of DEPRECATED_MANAGED_MODEL_KEYS) {
      delete mergedModels[key]
    }
  }

  const selectedModelKey = options.selectedModelKey || OPENCODE_MODEL_KEY
  const selectedModel = isRecord(mergedModels[selectedModelKey])
    ? (mergedModels[selectedModelKey] as Record<string, unknown>)
    : {}
  const selectedVariants = isRecord(selectedModel.variants)
    ? (selectedModel.variants as Record<string, unknown>)
    : {}
  const variantName = options.selectedVariant || options.reasoningEffort
  const nextVariants = { ...selectedVariants }
  if (variantName) {
    const existingVariant = isRecord(nextVariants[variantName])
      ? (nextVariants[variantName] as Record<string, unknown>)
      : {}
    nextVariants[variantName] = {
      ...existingVariant,
      ...(options.reasoningEffort ? { reasoningEffort: options.reasoningEffort } : {}),
    }
  }

  return deepMerge<Record<string, unknown>>(mergedModels, {
    [OPENCODE_MODEL_KEY]: {
      options: {
        store: false,
      },
      variants: {
        low: {},
        medium: {},
        high: {},
        xhigh: {},
      },
    },
    [selectedModelKey]: {
      ...selectedModel,
      options: {
        ...(isRecord(selectedModel.options) ? selectedModel.options : {}),
        store: false,
      },
      variants: nextVariants,
    },
  })
}

function resolveOpenCodeModel(provider: Provider): { reference: string; modelKey: string } {
  const configured = resolveProviderModel(provider, OPENCODE_MODEL).trim()
  const reference = configured.includes('/') ? configured : `${OPENCODE_PROVIDER_KEY}/${configured}`
  const modelKey = reference.slice(reference.lastIndexOf('/') + 1).replace(/#.*$/, '')
  return {
    reference,
    modelKey: modelKey || OPENCODE_MODEL_KEY,
  }
}

/**
 * 写入 OpenCode 配置（零破坏性）
 *
 * 策略：
 * 1. 读取现有配置并保留未管理字段
 * 2. 使用模板生成默认配置（变量替换）
 * 3. 强制更新 provider.openai.options.baseURL/apiKey 与隐私相关 store 配置
 * 4. 写入 ~/.config/opencode/opencode.json
 */
export function writeOpenCodeConfig(provider: Provider, options: WriteOptions = {}): void {
  ensureDir(getOpenCodeDir())

  const configPath = getOpenCodeConfigPath()
  const existingConfig: OpenCodeConfig =
    options.mode === 'overwrite'
      ? {}
      : fileExists(configPath)
        ? readJSON<OpenCodeConfig>(configPath)
        : {}

  const meta = parseProviderMeta(provider.model)
  const selected = resolveOpenCodeModel(provider)
  const reasoning = resolveProviderReasoning(provider)
  const parameters = resolveProviderParameters(provider)
  const selectedVariant =
    resolveProviderVariant(provider) ||
    (reasoning?.mode === 'variant' && typeof reasoning.value === 'string'
      ? reasoning.value
      : undefined)
  const reasoningEffort =
    reasoning?.mode === 'effort' && typeof reasoning.value === 'string'
      ? reasoning.value
      : undefined

  // 1) 生成默认配置（来自模板文件）
  const template = loadOpenCodeTemplateConfig()
  const defaultConfig = replaceVariables(template, {
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
  }) as OpenCodeConfig

  // 2) 合并用户现有配置（用户优先，保留未管理字段）
  const mergedConfig =
    options.mode === 'overwrite'
      ? ({ ...defaultConfig } as OpenCodeConfig)
      : deepMerge<OpenCodeConfig>(defaultConfig, existingConfig)

  // 3) 构建/更新 provider.openai（强制更新认证与端点）
  const templateProvider = defaultConfig.provider?.[OPENCODE_PROVIDER_KEY]
  const existingProvider = mergedConfig.provider?.[OPENCODE_PROVIDER_KEY]

  const models = enforceModelStoreFalse(
    meta?.models || existingProvider?.models || templateProvider?.models || DEFAULT_MODELS,
    {
      removeDeprecatedManaged: !meta?.models,
      selectedModelKey: selected.modelKey,
      selectedVariant,
      reasoningEffort,
    }
  )

  const providerConfig: OpenCodeProvider = deepMerge<OpenCodeProvider>(templateProvider || {}, {
    ...(existingProvider || {}),
    options: {
      ...(existingProvider?.options || {}),
      baseURL: provider.baseUrl,
      apiKey: provider.apiKey,
    },
    models,
  })

  const existingProviders =
    options.mode === 'overwrite'
      ? {}
      : mergedConfig.provider &&
          typeof mergedConfig.provider === 'object' &&
          !Array.isArray(mergedConfig.provider)
        ? { ...mergedConfig.provider }
        : {}

  const nextConfig: OpenCodeConfig = {
    ...mergedConfig,
    $schema: OPENCODE_SCHEMA,
    model: selected.reference,
    agent: enforceAgentStoreFalse(mergedConfig.agent),
    provider: {
      ...existingProviders,
      [OPENCODE_PROVIDER_KEY]: providerConfig,
    },
  }

  const selectedModelWithVariant =
    selectedVariant && selected.reference ? `${selected.reference}#${selectedVariant}` : undefined
  if (selectedModelWithVariant) {
    const agents = nextConfig.agent || {}
    for (const agentName of ['build', 'plan']) {
      const agent = isRecord(agents[agentName]) ? { ...(agents[agentName] as any) } : {}
      const existingOptions = isRecord(agent.options) ? agent.options : {}
      agent.model = selectedModelWithVariant
      agent.options = existingOptions
      agents[agentName] = agent
    }
    nextConfig.agent = agents
  }

  if (typeof parameters.modelVariant === 'string' && parameters.modelVariant.trim()) {
    const variant = parameters.modelVariant.trim()
    const agents = nextConfig.agent || {}
    for (const agentName of ['build', 'plan']) {
      const agent = isRecord(agents[agentName]) ? { ...(agents[agentName] as any) } : {}
      agent.model = `${selected.reference}#${variant}`
      agents[agentName] = agent
    }
    nextConfig.agent = agents
  }

  writeJSON(configPath, nextConfig)
}
