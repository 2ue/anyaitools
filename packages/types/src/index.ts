/**
 * @anyaitools/types
 *
 * 通用 TypeScript 类型定义,不依赖 Node.js 环境,
 * 可在 Desktop 渲染进程等浏览器环境中安全使用。
 */

// ---------------------------------------------------------------------------
// 工具类型
// ---------------------------------------------------------------------------

export type ToolType = 'codex' | 'claude' | 'mcp' | 'gemini' | 'opencode' | 'openclaw' | 'grok'

export type MainToolType = 'codex' | 'claude' | 'gemini' | 'openclaw' | 'grok'

export type ApiBackend = 'chat_completions' | 'responses' | 'messages'

// 和 @anyaitools/core 中 constants.ts 的结构保持一致,但不引入任何 Node 依赖
export const TOOL_TYPES = {
  CODEX: 'codex',
  CLAUDE: 'claude',
  MCP: 'mcp',
  GEMINI: 'gemini',
  OPENCODE: 'opencode',
  OPENCLAW: 'openclaw',
  GROK: 'grok',
} as const

export const MAIN_TOOL_TYPES = {
  CODEX: TOOL_TYPES.CODEX,
  CLAUDE: TOOL_TYPES.CLAUDE,
  GEMINI: TOOL_TYPES.GEMINI,
  OPENCLAW: TOOL_TYPES.OPENCLAW,
  GROK: TOOL_TYPES.GROK,
} as const

export const TOOL_CONFIG = {
  [TOOL_TYPES.CODEX]: {
    displayName: 'Codex',
    color: 'blue',
    textColorClass: 'text-blue-600',
    bgColorClass: 'bg-blue-50',
    hoverBgColorClass: 'hover:bg-blue-100',
    description: 'Codex AI 助手',
  },
  [TOOL_TYPES.CLAUDE]: {
    displayName: 'Claude Code',
    color: 'purple',
    textColorClass: 'text-purple-600',
    bgColorClass: 'bg-purple-50',
    hoverBgColorClass: 'hover:bg-purple-100',
    description: 'Claude Code AI 助手',
  },
  [TOOL_TYPES.MCP]: {
    displayName: 'MCP',
    color: 'gray',
    textColorClass: 'text-gray-600',
    bgColorClass: 'bg-gray-50',
    hoverBgColorClass: 'hover:bg-gray-100',
    description: 'MCP 服务',
  },
  [TOOL_TYPES.GEMINI]: {
    displayName: 'Gemini CLI',
    color: 'green',
    textColorClass: 'text-green-600',
    bgColorClass: 'bg-green-50',
    hoverBgColorClass: 'hover:bg-green-100',
    description: 'Gemini CLI AI 助手',
  },
  [TOOL_TYPES.OPENCODE]: {
    displayName: 'OpenCode',
    color: 'amber',
    textColorClass: 'text-amber-600',
    bgColorClass: 'bg-amber-50',
    hoverBgColorClass: 'hover:bg-amber-100',
    description: 'OpenCode 配置',
  },
  [TOOL_TYPES.OPENCLAW]: {
    displayName: 'OpenClaw',
    color: 'teal',
    textColorClass: 'text-teal-600',
    bgColorClass: 'bg-teal-50',
    hoverBgColorClass: 'hover:bg-teal-100',
    description: 'OpenClaw 配置',
  },
  [TOOL_TYPES.GROK]: {
    displayName: 'Grok Build',
    color: 'red',
    textColorClass: 'text-red-600',
    bgColorClass: 'bg-red-50',
    hoverBgColorClass: 'hover:bg-red-100',
    description: 'xAI 官方 Grok CLI',
  },
} as const

// ---------------------------------------------------------------------------
// Provider / Preset 相关类型
// 来源: packages/core/src/tool-manager.types.ts
// ---------------------------------------------------------------------------

export interface Provider {
  /** 唯一标识符(自动生成) */
  id: string
  /** 显示名称 */
  name: string
  /** 描述(可选,用于 UI 展示) */
  desc?: string
  /** API Base URL */
  baseUrl: string
  /** API Key */
  apiKey: string
  /** 模型名称(可选) */
  model?: string
  /** 按工具保存的结构化模型配置（兼容旧版 model 字段） */
  modelConfig?: ToolModelConfig
  /** API 协议后端(可选,用于 Grok CLI 等支持多协议的工具) */
  apiBackend?: ApiBackend
  /** 是否支持服务端搜索(可选) */
  supportsBackendSearch?: boolean
  /** 创建时间(Unix timestamp) */
  createdAt: number
  /** 最后修改时间(Unix timestamp) */
  lastModified: number
  /** 最后使用时间(Unix timestamp,可选) */
  lastUsedAt?: number
}

export interface PresetTemplate {
  /** 预设名称 */
  name: string
  /** 默认 Base URL */
  baseUrl: string
  /** 描述 */
  description: string
  /** 是否为内置预设 */
  isBuiltIn: boolean
  /** 默认模型名称(可选) */
  model?: string
  /** 默认结构化模型配置（可选） */
  modelConfig?: ToolModelConfig
  /** 默认 API 协议后端(可选) */
  apiBackend?: ApiBackend
  /** 是否支持服务端搜索(可选) */
  supportsBackendSearch?: boolean
}

export interface AddProviderInput {
  name: string
  desc?: string
  baseUrl: string
  apiKey: string
  model?: string
  modelConfig?: ToolModelConfig
  apiBackend?: ApiBackend
  supportsBackendSearch?: boolean
}

export interface EditProviderInput {
  name?: string
  desc?: string
  baseUrl?: string
  apiKey?: string
  model?: string
  modelConfig?: ToolModelConfig
  apiBackend?: ApiBackend
  supportsBackendSearch?: boolean
}

export interface AddPresetInput {
  name: string
  baseUrl: string
  description: string
  model?: string
  modelConfig?: ToolModelConfig
  apiBackend?: ApiBackend
  supportsBackendSearch?: boolean
}

export interface EditPresetInput {
  name?: string
  baseUrl?: string
  description?: string
  model?: string
  modelConfig?: ToolModelConfig
  apiBackend?: ApiBackend
  supportsBackendSearch?: boolean
}

export type ModelToolType = Exclude<ToolType, 'mcp'>

export type ModelCatalogSource =
  | 'official'
  | 'provider-api'
  | 'models-dev'
  | 'openclaw-cli'
  | 'cached'
  | 'manual'

export type ModelReasoningMode = 'effort' | 'thinking' | 'budget' | 'variant' | 'unsupported'

export interface ModelReasoningConfig {
  mode: ModelReasoningMode
  value?: string | number
  visible?: boolean
  supportedValues?: Array<string | number>
}

export interface ToolModelConfig {
  /** 实际模型 ID；OpenCode/OpenClaw 通常为 provider/model-id */
  modelId?: string
  /** 展示名称 */
  displayName?: string
  /** 模型目录或手动输入来源 */
  source?: ModelCatalogSource
  /** OpenCode 等工具的 variant */
  variant?: string
  /** 工具相关的推理/思考配置 */
  reasoning?: ModelReasoningConfig
  /** 工具特有的模型参数（如 Gemini thinkingBudget） */
  parameters?: Record<string, unknown>
  /** 能力和原始 provider 元数据 */
  capabilities?: Record<string, unknown>
  /** 保留无法标准化的官方字段 */
  raw?: Record<string, unknown>
}

export interface ModelCatalogEntry {
  id: string
  name?: string
  providerId?: string
  source: ModelCatalogSource
  reasoning?: {
    mode: ModelReasoningMode
    supportedValues?: Array<string | number>
  }
  variants?: string[]
  capabilities?: Record<string, unknown>
}

export interface ModelCatalog {
  tool: ModelToolType
  providerId?: string
  source: ModelCatalogSource
  fetchedAt: number
  models: ModelCatalogEntry[]
  warnings?: string[]
}

export interface ModelCatalogRequest {
  tool: ModelToolType
  provider: Pick<Provider, 'id' | 'name' | 'baseUrl' | 'apiKey' | 'model' | 'modelConfig'>
  refresh?: boolean
}

// ---------------------------------------------------------------------------
// MCP 相关类型
// 来源: packages/core/src/writers/mcp.ts
// ---------------------------------------------------------------------------

/** Tools that can host an MCP server configuration. */
export type MCPToolType = Exclude<ToolType, 'mcp'>

/** Legacy name kept for the existing renderer/CLI API. */
export type AppType = MCPToolType

export type MCPTransportType = 'stdio' | 'sse' | 'streamable-http' | 'http'

export interface MCPStdioTransport {
  type: 'stdio'
  command: string
  args: string[]
  env?: Record<string, string | number>
  cwd?: string
  envVars?: string[]
}

export interface MCPRemoteTransport {
  type: Exclude<MCPTransportType, 'stdio'>
  url: string
  headers?: Record<string, string>
  bearerTokenEnvVar?: string
}

export type MCPTransport = MCPStdioTransport | MCPRemoteTransport

export type MCPSourceKind = 'manual' | 'json' | 'registry' | 'github'

export interface MCPSource {
  kind: MCPSourceKind
  url?: string
  repository?: string
  version?: string
}

/**
 * Canonical MCP server model. The legacy command/args/env/enabledApps fields
 * remain optional so old backups and integrations can be read without a
 * destructive migration.
 */
export interface MCPServer {
  id: string
  name: string
  transport: MCPTransport
  description?: string
  source?: MCPSource
  /**
   * Optional capability declaration from a registry or manifest. This limits
   * which host tools may receive the server; it does not enable those tools.
   */
  supportedTools?: MCPToolType[]
  createdAt: number
  lastModified: number
  enabledTools: Partial<Record<MCPToolType, boolean>>

  /** @deprecated use transport.type === 'stdio' and its fields */
  command?: string
  /** @deprecated use transport.type === 'stdio' and its fields */
  args?: string[]
  /** @deprecated use transport.type === 'stdio' and its fields */
  env?: Record<string, string | number>
  /** @deprecated use enabledTools */
  enabledApps?: AppType[]
}

export interface MCPConfig {
  schemaVersion?: number
  servers: MCPServer[]
  /** Names used for one-write cleanup of renamed/removed entries. */
  managedServerNames: Partial<Record<MCPToolType, string[]>>
}

export interface MCPToolCapability {
  tool: MCPToolType
  displayName: string
  supported: boolean
  reason?: string
  configPath?: string
  transportTypes: MCPTransportType[]
}

export interface MCPServerInput {
  name: string
  transport: MCPTransport
  description?: string
  source?: MCPSource
  enabledTools?: Partial<Record<MCPToolType, boolean>>
  supportedTools?: MCPToolType[]
}

export type MCPImportDuplicateStrategy = 'skip' | 'overwrite' | 'rename'

export interface MCPImportOptions {
  duplicateStrategy?: MCPImportDuplicateStrategy
  source?: MCPSource
}

export interface MCPImportResult {
  servers: MCPServer[]
  added: MCPServer[]
  skipped: string[]
  renamed: Array<{ from: string; to: string }>
  warnings: string[]
}

export interface MCPValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  serverCount: number
}

export interface MCPExportOptions {
  tools?: MCPToolType[]
  includeDisabled?: boolean
}

export interface MCPRegistry {
  name?: string
  version?: number
  description?: string
  servers: MCPServerInput[]
  source?: MCPSource
  entries?: MCPRegistryEntry[]
  fetchedAt?: number
  nextCursor?: string
  warnings?: string[]
}

export type MCPRegistrySourceKind = 'official-api' | 'json' | 'github'

export type MCPRegistryParser =
  | 'official-registry'
  | 'generic-json'
  | 'community-catalog'
  | 'github-readme'

export interface MCPRegistrySource {
  id: string
  name: string
  kind: MCPRegistrySourceKind
  url: string
  description?: string
  builtIn: boolean
  enabled: boolean
  parser: MCPRegistryParser
  maxResponseBytes?: number
  lastFetchedAt?: number
  lastSuccessAt?: number
  lastError?: string
}

export interface MCPRegistryEntry {
  id: string
  name: string
  description?: string
  category?: string
  authType?: string
  toolCount?: number
  installConfidence?: string
  repository?: string
  documentationUrl?: string
  license?: string
  transportType?: MCPTransportType
  supportedTools?: MCPToolType[]
  envRequirements?: string[]
  warnings: string[]
  sourceId: string
  sourceUrl: string
  installable: boolean
  server?: MCPServerInput
}

export interface MCPRegistrySnapshot {
  source: MCPRegistrySource
  entries: MCPRegistryEntry[]
  fetchedAt?: number
  stale: boolean
  error?: string
  nextCursor?: string
}

export interface MCPRegistrySourceInput {
  name: string
  kind: MCPRegistrySourceKind
  url: string
  description?: string
  parser?: MCPRegistryParser
  enabled?: boolean
}

export interface MCPRegistryQuery {
  query?: string
  sourceIds?: string[]
  transportTypes?: MCPTransportType[]
  installableOnly?: boolean
  refresh?: boolean
}

// ---------------------------------------------------------------------------
// WebDAV 同步相关类型
// 来源: packages/core/src/sync/types.ts
// ---------------------------------------------------------------------------

export type WebDAVAuthType = 'password' | 'digest'

export interface SyncConfig {
  webdavUrl: string
  username: string
  password: string
  authType?: WebDAVAuthType
  remoteDir?: string
  syncPassword?: string
}

// ---------------------------------------------------------------------------
// Claude Clean (~/.claude.json) 相关类型
// 来源: packages/core/src/claude-clean.ts
// ---------------------------------------------------------------------------

export interface CleanOptions {
  cleanProjectHistory?: boolean
  keepRecentCount?: number
  projectPaths?: string[]
  cleanCache?: boolean
  cleanStats?: boolean
}

export interface CleanResult {
  sizeBefore: number
  sizeAfter: number
  saved: number
  cleanedItems: {
    projectHistory: number
    cache: boolean
    stats: boolean
  }
  backupPath: string
}

export interface AnalyzeResult {
  fileSize: number
  fileSizeFormatted: string
  projectCount: number
  totalHistoryCount: number
  projectHistory: Array<{
    path: string
    count: number
  }>
  cacheSize: number
  estimatedSavings: {
    conservative: number
    moderate: number
    aggressive: number
  }
}

export interface ProjectDetail {
  path: string
  historyCount: number
  estimatedSize: number
  lastMessage?: string
}

export interface CacheDetail {
  key: string
  name: string
  size: number
  sizeFormatted: string
  lastUpdated?: number
}

export interface HistoryEntry {
  display: string
  pastedContents: Record<string, any>
}
