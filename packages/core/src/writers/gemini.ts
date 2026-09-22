import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { getGeminiDir, getGeminiSettingsPath, getGeminiEnvPath } from '../paths.js'
import { ensureDir, fileExists } from '../utils/file.js'
import type { Provider } from '../tool-manager.js'
import type { WriteOptions } from '../tool-manager.types.js'
import { deepMerge } from '../utils/template.js'
import {
  resolveProviderModel,
  resolveProviderParameters,
  resolveProviderReasoning,
} from '../model-config.js'

/**
 * Gemini CLI settings.json 顶层结构（宽松定义，保持向后兼容）
 */
interface GeminiSettings {
  ide?: {
    enabled?: boolean
    // 预留其他字段
    [key: string]: unknown
  }
  security?: {
    auth?: {
      selectedType?: string
      enforcedType?: string
      useExternal?: boolean
      // 预留其他字段
      [key: string]: unknown
    }
    // 预留其他字段
    [key: string]: unknown
  }
  // 其他字段使用索引签名保留
  [key: string]: unknown
}

interface GeminiProviderMeta {
  authType?: string
  defaultModel?: string
  env?: Record<string, string>
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

const GEMINI_SETTINGS_TEMPLATE: GeminiSettings = {
  ide: {
    enabled: true,
  },
  security: {
    auth: {
      selectedType: 'gemini-api-key',
    },
  },
}

const GEMINI_ENV_TEMPLATE = [
  '# Managed by anyaitools',
  'GOOGLE_GEMINI_BASE_URL={{baseUrl}}',
  'GEMINI_API_KEY={{apiKey}}',
  'GEMINI_MODEL=gemini-3.5-flash',
].join('\n')

/**
 * 读取 Gemini settings 模板
 *
 * 优先从 templates/gemini/settings.json 读取，
 * 如果不存在或读取失败，则回退到 GEMINI_SETTINGS_TEMPLATE
 */
function loadGeminiSettingsTemplate(): GeminiSettings {
  try {
    const templatePath = resolveTemplatePath('gemini/settings.json')
    if (templatePath) {
      const content = fs.readFileSync(templatePath, 'utf-8')
      return JSON.parse(content) as GeminiSettings
    }
  } catch {
    // 忽略错误，使用内置默认模板
  }

  return GEMINI_SETTINGS_TEMPLATE
}

/**
 * 读取 Gemini .env 模板（支持 {{baseUrl}}/{{apiKey}} 变量）
 */
function loadGeminiEnvTemplate(provider: Provider): Record<string, string> {
  let templateContent = GEMINI_ENV_TEMPLATE

  try {
    const templatePath = resolveTemplatePath('gemini/.env')
    if (templatePath) {
      templateContent = fs.readFileSync(templatePath, 'utf-8')
    }
  } catch {
    // 忽略错误，使用内置默认模板
  }

  const content = templateContent
    .replaceAll('{{baseUrl}}', provider.baseUrl || '')
    .replaceAll('{{apiKey}}', provider.apiKey || '')

  return parseEnvContent(content)
}

/**
 * 读取 .env 文件为键值对（简单解析 KEY=VALUE，忽略注释和空行）
 */
function parseEnvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {}

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim()
    if (!key) continue
    result[key] = value
  }

  return result
}

function loadEnvFile(envPath: string): Record<string, string> {
  if (!fileExists(envPath)) return {}
  const content = fs.readFileSync(envPath, 'utf-8')
  return parseEnvContent(content)
}

/** Normalize legacy/provider metadata to Gemini CLI auth identifiers. */
function resolveGeminiAuthType(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const normalized = raw.trim().toLowerCase()
  if (!normalized) return undefined

  switch (normalized) {
    case 'oauth':
    case 'oauth-personal':
    case 'login_with_google':
    case 'google-oauth':
      return 'oauth-personal'
    case 'api-key':
    case 'gemini-api-key':
    case 'use_gemini':
    case 'gemini':
      return 'gemini-api-key'
    case 'vertex-ai':
    case 'use_vertex_ai':
    case 'vertex':
      return 'vertex-ai'
    case 'compute-default-credentials':
    case 'compute_adc':
    case 'adc':
      return 'compute-default-credentials'
    case 'cloud-shell':
    case 'legacy_cloud_shell':
      return 'cloud-shell'
    case 'gateway':
      return 'gateway'
    default:
      return undefined
  }
}

/**
 * 将键值对写入 .env 文件（简单覆盖，按 KEY 排序）
 */
function saveEnvFile(envPath: string, env: Record<string, string>): void {
  const lines: string[] = []
  const keys = Object.keys(env).sort()
  for (const key of keys) {
    lines.push(`${key}=${String(env[key])}`)
  }
  const content = lines.join('\n') + (lines.length ? '\n' : '')
  const tempPath = `${envPath}.tmp`
  fs.writeFileSync(tempPath, content, { mode: 0o600 })
  fs.renameSync(tempPath, envPath)
}

function applyGeminiModelConfig(settings: GeminiSettings, provider: Provider): void {
  const modelId = resolveProviderModel(provider, '')
  if (modelId) {
    const currentModel =
      settings.model && typeof settings.model === 'object' && !Array.isArray(settings.model)
        ? (settings.model as Record<string, unknown>)
        : {}
    settings.model = { ...currentModel, name: modelId }
  }

  const reasoning = resolveProviderReasoning(provider)
  const parameters = resolveProviderParameters(provider)
  const hasThinkingConfig =
    (reasoning?.mode === 'budget' || reasoning?.mode === 'thinking') &&
    (typeof reasoning.value === 'number' || reasoning.visible !== undefined)
  if (hasThinkingConfig) {
    const existingConfigs =
      settings.modelConfigs &&
      typeof settings.modelConfigs === 'object' &&
      !Array.isArray(settings.modelConfigs)
        ? (settings.modelConfigs as Record<string, unknown>)
        : {}
    const aliases =
      existingConfigs.customAliases &&
      typeof existingConfigs.customAliases === 'object' &&
      !Array.isArray(existingConfigs.customAliases)
        ? (existingConfigs.customAliases as Record<string, unknown>)
        : {}
    settings.modelConfigs = {
      ...existingConfigs,
      customAliases: {
        ...aliases,
        anyaitools: {
          modelConfig: {
            model: modelId,
            generateContentConfig: {
              ...(isRecord(parameters.generateContentConfig)
                ? parameters.generateContentConfig
                : {}),
              thinkingConfig: {
                ...(typeof reasoning.value === 'number' ? { thinkingBudget: reasoning.value } : {}),
                ...(reasoning.visible === undefined ? {} : { includeThoughts: reasoning.visible }),
              },
            },
          },
        },
      },
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 将 Provider 应用到 Gemini CLI 的配置（按照官方文档）
 *
 * settings.json（官方配置）:
 * {
 *   "ide": { "enabled": true },
 *   "security": { "auth": { "selectedType": "gemini-api-key" } }
 * }
 *
 * ~/.gemini/.env（官方配置）:
 * GOOGLE_GEMINI_BASE_URL=https://okmcode.com
 * GEMINI_API_KEY=YOUR_API_KEY
 * GEMINI_MODEL=gemini-3.5-flash
 */
export function writeGeminiConfig(provider: Provider, options: WriteOptions = {}): void {
  const settingsPath = getGeminiSettingsPath()
  const envPath = getGeminiEnvPath()
  const dir = getGeminiDir()
  let modelMeta: GeminiProviderMeta | null = null

  // Parse metadata before writing settings so auth mode changes accompany the
  // endpoint/API key update in one operation.
  if (provider.model && provider.model.trim().length > 0) {
    try {
      const parsed = JSON.parse(provider.model)
      if (parsed && typeof parsed === 'object') {
        modelMeta = parsed as GeminiProviderMeta
      }
    } catch {
      // Plain model names are handled when the .env file is generated.
    }
  }

  // 确保目录存在
  ensureDir(dir)

  const settingsTemplate = loadGeminiSettingsTemplate()
  let userSettings: GeminiSettings = {}

  if (options.mode !== 'overwrite' && fileExists(settingsPath)) {
    try {
      const content = fs.readFileSync(settingsPath, 'utf-8')
      const parsed = JSON.parse(content)
      if (parsed && typeof parsed === 'object') {
        userSettings = parsed as GeminiSettings
      }
    } catch (error) {
      throw new Error(`无法读取 Gemini settings.json: ${(error as Error).message}`)
    }
  }

  const settings =
    options.mode === 'overwrite'
      ? ({ ...settingsTemplate } as GeminiSettings)
      : deepMerge<GeminiSettings>(settingsTemplate, userSettings)

  applyGeminiModelConfig(settings, provider)

  // 确保启用 IDE 集成
  if (!settings.ide || typeof settings.ide !== 'object') {
    settings.ide = {}
  }
  if (settings.ide.enabled === undefined) {
    settings.ide.enabled = true
  }

  // Follow explicit provider auth metadata, then infer API-key mode from a
  // non-empty key. With neither signal, preserve an existing user choice.
  if (!settings.security || typeof settings.security !== 'object') {
    settings.security = {}
  }
  if (!settings.security.auth || typeof settings.security.auth !== 'object') {
    settings.security.auth = {}
  }
  const providerAuthType =
    resolveGeminiAuthType(modelMeta?.authType) ||
    (provider.apiKey.trim() ? 'gemini-api-key' : undefined)
  if (providerAuthType) {
    settings.security.auth.selectedType = providerAuthType
  } else if (settings.security.auth.selectedType === undefined) {
    settings.security.auth.selectedType = 'gemini-api-key'
  }

  // 原子写入 settings.json
  try {
    const tempPath = `${settingsPath}.tmp`
    fs.writeFileSync(tempPath, JSON.stringify(settings, null, 2), {
      mode: 0o600,
    })
    fs.renameSync(tempPath, settingsPath)
  } catch (error) {
    throw new Error(`写入 Gemini settings.json 失败: ${(error as Error).message}`)
  }

  // 2. 更新 ~/.gemini/.env
  const existingEnv = options.mode === 'overwrite' ? {} : loadEnvFile(envPath)
  const templateEnv = loadGeminiEnvTemplate(provider)
  const env = {
    ...existingEnv,
    ...templateEnv,
  }
  const existingGeminiModel = existingEnv.GEMINI_MODEL
  const selectedModel = resolveProviderModel(provider, '')
  if (selectedModel) {
    env.GEMINI_MODEL = selectedModel
  }

  // 模板变量为空时，显式移除对应键
  if (!templateEnv.GOOGLE_GEMINI_BASE_URL) {
    delete env.GOOGLE_GEMINI_BASE_URL
  }
  if (!templateEnv.GEMINI_API_KEY) {
    delete env.GEMINI_API_KEY
  }
  if (!selectedModel && options.mode !== 'overwrite' && existingGeminiModel) {
    env.GEMINI_MODEL = existingGeminiModel
  }

  // 解析 provider.model（可能是 JSON 元数据或纯字符串）
  if (provider.model && !modelMeta) {
    // 不是 JSON，当作普通模型名称
    if (!selectedModel) env.GEMINI_MODEL = provider.model
  }

  // 如果是 JSON 元数据，合并 env 并处理 fallback
  if (modelMeta) {
    // 合并 meta.env 到 .env
    if (modelMeta.env && typeof modelMeta.env === 'object') {
      for (const [key, value] of Object.entries(modelMeta.env)) {
        if (typeof value === 'string') {
          env[key] = value
        }
      }
    }
    // provider 元数据优先于模板默认值；已有用户自定义模型在非覆盖模式下保留
    if (
      modelMeta.defaultModel &&
      !selectedModel &&
      (!existingGeminiModel || options.mode === 'overwrite')
    ) {
      env.GEMINI_MODEL = modelMeta.defaultModel
    }
  }

  saveEnvFile(envPath, env)
}
