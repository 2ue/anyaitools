import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { parse as parseToml, stringify as stringifyToml } from '@iarna/toml'
import type { Provider } from '../tool-manager.js'
import type { WriteOptions } from '../tool-manager.types.js'
import { getCodexConfigPath, getCodexAuthPath, getCodexDir } from '../paths.js'
import { OKMCODE_ROOT_URL } from '../presets/okmcode.js'
import { getCodexSettings } from '../codex-settings.js'
import { ensureDir, fileExists, readJSON, writeJSON } from '../utils/file.js'
import { deepMerge } from '../utils/template.js'
import {
  resolveProviderModel,
  resolveProviderParameters,
  resolveProviderReasoning,
} from '../model-config.js'

/**
 * Codex config.toml 结构
 */
interface CodexConfig {
  model_provider?: string
  model?: string
  review_model?: string
  model_reasoning_effort?: string
  plan_mode_reasoning_effort?: string
  model_reasoning_summary?: string
  model_verbosity?: string
  personality?: string
  web_search?: string
  sandbox_mode?: string
  approval_policy?: string
  file_opener?: string
  history?: CodexHistory
  tui?: CodexTui
  shell_environment_policy?: CodexShellEnvironmentPolicy
  features?: CodexFeatures
  sandbox_workspace_write?: CodexSandboxWorkspaceWrite
  windows?: CodexWindows
  windows_wsl_setup_acknowledged?: boolean
  notice?: CodexNotice
  model_providers?: Record<string, CodexModelProvider>
  [key: string]: unknown // 保留其他用户自定义字段
}

interface CodexHistory {
  persistence?: string
  [key: string]: unknown
}

interface CodexTui {
  notifications?: boolean
  [key: string]: unknown
}

interface CodexShellEnvironmentPolicy {
  inherit?: string
  ignore_default_excludes?: boolean
  [key: string]: unknown
}

interface CodexFeatures {
  unified_exec?: boolean
  multi_agent?: boolean
  shell_tool?: boolean
  shell_snapshot?: boolean
  fast_mode?: boolean
  personality?: boolean
  [key: string]: unknown
}

interface CodexWindows {
  sandbox?: 'unelevated' | 'elevated'
  [key: string]: unknown
}

interface CodexSandboxWorkspaceWrite {
  network_access?: boolean
  [key: string]: unknown
}

interface CodexNotice {
  hide_gpt5_1_migration_prompt?: boolean
  [key: string]: unknown
}

interface CodexModelProvider {
  name: string
  base_url: string
  wire_api: string
  requires_openai_auth: boolean
  [key: string]: unknown
}

/**
 * Codex auth.json 结构
 */
interface CodexAuth {
  OPENAI_API_KEY: string
  [key: string]: unknown
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

/**
 * Codex 默认配置模板（回退）
 *
 * 与 templates/codex/config.toml 保持一致
 * 版本迭代时优先修改模板，并同步更新此回退对象
 *
 * 注意：
 * - model_provider 和 model_providers 会在运行时动态设置（根据 Provider）
 * - 这里定义的是其他默认字段
 */
const CODEX_DEFAULT_CONFIG: Partial<CodexConfig> = {
  model: 'gpt-5.5',
  review_model: 'gpt-5.5',
  model_reasoning_effort: 'xhigh',
  plan_mode_reasoning_effort: 'xhigh',
  model_reasoning_summary: 'auto',
  model_verbosity: 'high',
  personality: 'pragmatic',
  sandbox_mode: 'danger-full-access',
  approval_policy: 'never',
  file_opener: 'vscode',
  web_search: 'cached',
  suppress_unstable_features_warning: true,
  history: {
    persistence: 'save-all',
  },
  tui: {
    notifications: true,
  },
  shell_environment_policy: {
    inherit: 'all',
    ignore_default_excludes: false,
  },
  sandbox_workspace_write: {
    network_access: true,
  },
  windows: {
    sandbox: 'elevated',
  },
  features: {
    multi_agent: true,
    shell_tool: true,
    shell_snapshot: true,
    fast_mode: true,
    personality: true,
  },
  notice: {
    hide_gpt5_1_migration_prompt: true,
  },
}

const OKMCODE_PROVIDER_HOST = new URL(OKMCODE_ROOT_URL).hostname.toLowerCase()

const DEPRECATED_FEATURE_KEYS = [
  'web_search_request',
  'web_search_cached',
  'web_search',
  'plan_tool',
  'view_image_tool',
  'streamable_shell',
  'rmcp_client',
  'apply_patch_freeform',
] as const

const DEPRECATED_ROOT_KEYS = [
  'web_search_request',
  'disable_response_storage',
  'network_access',
  'profile',
  'profiles',
  'experimental_use_exec_command_tool',
  'include_apply_patch_tool',
] as const

const CONFLICTING_PROVIDER_AUTH_KEYS = [
  'env_key',
  'env_key_instructions',
  'experimental_bearer_token',
  'auth',
  'aws',
] as const

function applyCodexModelConfig(config: CodexConfig, provider: Provider): void {
  config.model = resolveProviderModel(provider, config.model || 'gpt-5.5')

  const reasoning = resolveProviderReasoning(provider)
  if (reasoning?.mode === 'effort' && typeof reasoning.value === 'string') {
    config.model_reasoning_effort = reasoning.value
  }

  const parameters = resolveProviderParameters(provider)
  if (typeof parameters.planModeReasoningEffort === 'string') {
    config.plan_mode_reasoning_effort = parameters.planModeReasoningEffort
  }
  if (typeof parameters.reviewModel === 'string' && parameters.reviewModel.trim()) {
    config.review_model = parameters.reviewModel.trim()
  }
  if (typeof parameters.modelReasoningSummary === 'string') {
    config.model_reasoning_summary = parameters.modelReasoningSummary
  }
  if (typeof parameters.modelVerbosity === 'string') {
    config.model_verbosity = parameters.modelVerbosity
  }
}

function resolveCodexProviderKey(provider: Provider): string {
  try {
    const hostname = new URL(provider.baseUrl).hostname.toLowerCase()
    if (hostname === OKMCODE_PROVIDER_HOST || hostname.endsWith(`.${OKMCODE_PROVIDER_HOST}`)) {
      return 'okmcode'
    }
  } catch {
    // Invalid URLs are validated by the caller; keep the provider name as a safe fallback.
  }
  return provider.name
}

/**
 * 加载 Codex 模板配置
 *
 * 优先从 templates/codex/config.toml 读取，
 * 如果不存在或读取失败，则回退到 CODEX_DEFAULT_CONFIG
 */
function loadCodexTemplateConfig(): Partial<CodexConfig> {
  try {
    const templatePath = resolveTemplatePath('codex/config.toml')
    if (templatePath) {
      const content = fs.readFileSync(templatePath, 'utf-8')
      return parseToml(content) as CodexConfig
    }
  } catch {
    // 忽略错误，使用内置默认配置
  }
  return CODEX_DEFAULT_CONFIG
}

function removeDeprecatedKeys(config: CodexConfig): void {
  if (config.features && typeof config.features === 'object' && !Array.isArray(config.features)) {
    const features = config.features as Record<string, unknown>
    const legacyElevatedSandbox = features.elevated_windows_sandbox
    if (
      typeof legacyElevatedSandbox === 'boolean' &&
      (!config.windows || config.windows.sandbox === undefined)
    ) {
      config.windows = {
        ...(config.windows || {}),
        sandbox: legacyElevatedSandbox ? 'elevated' : 'unelevated',
      }
    }
    delete features.elevated_windows_sandbox

    for (const key of DEPRECATED_FEATURE_KEYS) {
      if (key in features) delete features[key]
    }
  }

  const root = config as Record<string, unknown>
  for (const key of DEPRECATED_ROOT_KEYS) {
    if (key in root) delete root[key]
  }

  // Codex only exposes this onboarding state in Windows builds; strict config rejects it elsewhere.
  if (process.platform !== 'win32') {
    delete root.windows_wsl_setup_acknowledged
  }
}

function loadExistingCodexConfig(configPath: string): CodexConfig {
  if (!fileExists(configPath)) {
    return {}
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8')
    return parseToml(content) as CodexConfig
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`无法解析现有 Codex config.toml，已中止切换以避免覆盖: ${message}`)
  }
}

function loadExistingCodexAuth(authPath: string): CodexAuth {
  if (!fileExists(authPath)) {
    return { OPENAI_API_KEY: '' }
  }

  try {
    return readJSON<CodexAuth>(authPath)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`无法解析现有 Codex auth.json，已中止切换以避免覆盖: ${message}`)
  }
}

function buildManagedProvider(
  provider: Provider,
  providerKey: string,
  existingProvider: CodexModelProvider | undefined = undefined
): CodexModelProvider {
  const preservedProvider: Record<string, unknown> =
    existingProvider && typeof existingProvider === 'object' && !Array.isArray(existingProvider)
      ? { ...existingProvider }
      : {}

  for (const key of CONFLICTING_PROVIDER_AUTH_KEYS) {
    delete preservedProvider[key]
  }

  return {
    ...preservedProvider,
    name: providerKey,
    base_url: provider.baseUrl,
    wire_api: 'responses',
    requires_openai_auth: true,
  }
}

function writeCodexConfigOverwrite(provider: Provider): void {
  ensureDir(getCodexDir())

  const configPath = getCodexConfigPath()
  const templateConfig = loadCodexTemplateConfig()
  const nextConfig: CodexConfig = { ...(templateConfig as CodexConfig) }

  removeDeprecatedKeys(nextConfig)

  const providerKey = resolveCodexProviderKey(provider)
  nextConfig.model_provider = providerKey
  applyCodexModelConfig(nextConfig, provider)
  nextConfig.model_providers = {
    [providerKey]: buildManagedProvider(provider, providerKey),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fs.writeFileSync(configPath, stringifyToml(nextConfig as any), { mode: 0o600 })

  const authPath = getCodexAuthPath()
  const auth: CodexAuth = { OPENAI_API_KEY: provider.apiKey }
  writeJSON(authPath, auth)
}

function writeCodexConfigMerge(provider: Provider): void {
  ensureDir(getCodexDir())

  const configPath = getCodexConfigPath()
  const existingConfig = loadExistingCodexConfig(configPath)
  const authPath = getCodexAuthPath()
  const existingAuth = loadExistingCodexAuth(authPath)
  const templateConfig = loadCodexTemplateConfig()
  removeDeprecatedKeys(existingConfig)
  const nextConfig = deepMerge<CodexConfig>(templateConfig as CodexConfig, existingConfig)
  const resolvedProviderKey = resolveCodexProviderKey(provider)
  const existingProviderKey =
    typeof existingConfig.model_provider === 'string' && existingConfig.model_provider.trim()
      ? existingConfig.model_provider.trim()
      : undefined
  const providerKey =
    getCodexSettings().preserveProviderName && existingProviderKey
      ? existingProviderKey
      : resolvedProviderKey

  removeDeprecatedKeys(nextConfig)

  nextConfig.model_provider = providerKey
  applyCodexModelConfig(nextConfig, provider)

  const existingProviders =
    nextConfig.model_providers &&
    typeof nextConfig.model_providers === 'object' &&
    !Array.isArray(nextConfig.model_providers)
      ? { ...nextConfig.model_providers }
      : {}
  const userProviders =
    existingConfig.model_providers &&
    typeof existingConfig.model_providers === 'object' &&
    !Array.isArray(existingConfig.model_providers)
      ? existingConfig.model_providers
      : {}
  const lowerProviderKey = providerKey.toLowerCase()
  const existingManagedProvider =
    userProviders[providerKey] ||
    Object.entries(userProviders).find(([key]) => key.toLowerCase() === lowerProviderKey)?.[1]

  for (const key of Object.keys(existingProviders)) {
    if (key.toLowerCase() === lowerProviderKey) {
      delete existingProviders[key]
    }
  }

  nextConfig.model_providers = {
    ...existingProviders,
    [providerKey]: buildManagedProvider(provider, providerKey, existingManagedProvider),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fs.writeFileSync(configPath, stringifyToml(nextConfig as any), { mode: 0o600 })

  const nextAuth: CodexAuth = {
    ...existingAuth,
    OPENAI_API_KEY: provider.apiKey,
  }
  writeJSON(authPath, nextAuth)
}

/**
 * 写入 Codex 配置
 *
 * 策略：
 * 1. 默认 merge：保留用户字段和其他 provider，只更新当前 provider 与 API Key
 * 2. overwrite：用模板重建 config.toml，auth.json 仅保留 OPENAI_API_KEY
 * 3. 两种模式都会清理已废弃的 Codex 配置键
 *
 * 注意：
 * - TOML 解析器会丢失注释，这是已知限制
 * - 用户如果需要注释，建议放在单独的文档文件中
 */
export function writeCodexConfig(provider: Provider, options: WriteOptions = {}): void {
  if (options.mode === 'overwrite') {
    writeCodexConfigOverwrite(provider)
    return
  }

  writeCodexConfigMerge(provider)
}
