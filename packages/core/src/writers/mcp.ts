import * as fs from 'fs'
import * as path from 'path'
import { parse as parseToml, stringify as stringifyToml } from '@iarna/toml'
import {
  getClaudeConfigPath,
  getClaudeJsonPath,
  getAnyAIToolsDir,
  getClaudeDir,
  getCodexConfigPath,
  getCodexDir,
  getGeminiDir,
  getGeminiSettingsPath,
  getGrokConfigPath,
  getGrokDir,
} from '../paths.js'
import { fileExists, readJSON, writeJSON, ensureDir, createAtomicTempPath } from '../utils/file.js'
import type { Provider } from '../tool-manager.js'

// 从 @anyaitools/types 重新导出共享的 MCP 类型
export {
  type AppType,
  type MCPServer,
  type MCPConfig,
  type MCPToolType,
  type MCPToolCapability,
  type MCPTransport,
  type MCPTransportType,
  type MCPServerInput,
  type MCPImportOptions,
  type MCPImportResult,
  type MCPValidationResult,
  type MCPExportOptions,
  type MCPRegistry,
} from '@anyaitools/types'
import type {
  AppType,
  MCPServer,
  MCPConfig,
  MCPToolType,
  MCPToolCapability,
  MCPTransport,
  MCPTransportType,
  MCPServerInput,
  MCPImportOptions,
  MCPImportResult,
  MCPValidationResult,
  MCPExportOptions,
  MCPRegistry,
  MCPSource,
} from '@anyaitools/types'

const MCP_TOOLS: MCPToolType[] = ['claude', 'codex', 'gemini', 'opencode', 'openclaw', 'grok']
const JSON_MCP_TOOLS = new Set<MCPToolType>(['claude', 'gemini'])
const TOML_MCP_TOOLS = new Set<MCPToolType>(['codex', 'grok'])
const MCP_TOOL_SET = new Set<MCPToolType>(MCP_TOOLS)

const MCP_CAPABILITIES: MCPToolCapability[] = [
  {
    tool: 'claude',
    displayName: 'Claude Code',
    supported: true,
    // Claude stores MCP in ~/.claude.json. The legacy settings path is kept as
    // a fallback for versions of AnyAI Tools that wrote it there.
    configPath: getClaudeJsonPath(),
    transportTypes: ['stdio', 'sse', 'streamable-http', 'http'],
  },
  {
    tool: 'codex',
    displayName: 'Codex',
    supported: true,
    configPath: getCodexConfigPath(),
    transportTypes: ['stdio', 'streamable-http', 'http'],
  },
  {
    tool: 'gemini',
    displayName: 'Gemini CLI',
    supported: true,
    configPath: getGeminiSettingsPath(),
    transportTypes: ['stdio', 'sse', 'streamable-http', 'http'],
  },
  {
    tool: 'opencode',
    displayName: 'OpenCode',
    supported: false,
    reason: '当前版本没有稳定的官方 MCP 配置契约',
    transportTypes: [],
  },
  {
    tool: 'openclaw',
    displayName: 'OpenClaw',
    supported: false,
    reason: '当前版本没有稳定的官方 MCP 配置契约',
    transportTypes: [],
  },
  {
    tool: 'grok',
    displayName: 'Grok Build',
    supported: true,
    configPath: getGrokConfigPath(),
    transportTypes: ['stdio', 'streamable-http', 'http'],
  },
]

function getMCPToolCapabilities(): MCPToolCapability[] {
  return MCP_CAPABILITIES.map((capability) => ({
    ...capability,
    configPath:
      capability.tool === 'claude'
        ? process.env.NODE_ENV === 'test'
          ? getClaudeConfigPath()
          : getClaudeJsonPath()
        : capability.tool === 'codex'
          ? getCodexConfigPath()
          : capability.tool === 'gemini'
            ? getGeminiSettingsPath()
            : capability.tool === 'grok'
              ? getGrokConfigPath()
              : undefined,
  }))
}

export function getMCPToolCapability(tool: MCPToolType): MCPToolCapability {
  const capability = getMCPToolCapabilities().find((item) => item.tool === tool)
  if (!capability) throw new Error(`未知的 MCP 工具: ${tool}`)
  return capability
}

export function listMCPToolCapabilities(): MCPToolCapability[] {
  return getMCPToolCapabilities()
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cloneRecord<T extends Record<string, any>>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function normalizeSupportedTools(raw: unknown): MCPToolType[] | undefined {
  if (!Array.isArray(raw)) return undefined
  return [
    ...new Set(
      raw.map(String).filter((tool): tool is MCPToolType => MCP_TOOL_SET.has(tool as MCPToolType))
    ),
  ]
}

function normalizeEnabledTools(
  raw: unknown,
  supportedTools?: MCPToolType[]
): Partial<Record<MCPToolType, boolean>> {
  if (!isRecord(raw)) return {}
  const enabledTools: Partial<Record<MCPToolType, boolean>> = {}
  for (const [tool, enabled] of Object.entries(raw)) {
    const capability = MCP_CAPABILITIES.find((item) => item.tool === tool)
    if (
      MCP_TOOL_SET.has(tool as MCPToolType) &&
      enabled === true &&
      capability?.supported === true &&
      (supportedTools === undefined || supportedTools.includes(tool as MCPToolType))
    ) {
      enabledTools[tool as MCPToolType] = true
    } else if (MCP_TOOL_SET.has(tool as MCPToolType) && enabled === false) {
      enabledTools[tool as MCPToolType] = false
    }
  }
  return enabledTools
}

function isServerToolSupported(server: MCPServer, tool: MCPToolType): boolean {
  const capability = getMCPToolCapability(tool)
  return (
    capability.supported &&
    capability.transportTypes.includes(server.transport.type) &&
    (server.supportedTools === undefined || server.supportedTools.includes(tool))
  )
}

function isServerToolEnabled(server: MCPServer, tool: MCPToolType): boolean {
  return isServerToolSupported(server, tool) && server.enabledTools[tool] === true
}

function normalizeTransport(raw: any): MCPTransport {
  if (isRecord(raw) && typeof raw.type === 'string') {
    if (raw.type === 'stdio') {
      return {
        type: 'stdio',
        command: String(raw.command || ''),
        args: Array.isArray(raw.args) ? raw.args.map(String) : [],
        ...(isRecord(raw.env) ? { env: raw.env as Record<string, string | number> } : {}),
        ...(typeof raw.cwd === 'string' ? { cwd: raw.cwd } : {}),
        ...(Array.isArray(raw.envVars) ? { envVars: raw.envVars.map(String) } : {}),
      }
    }
    const remoteType = raw.type === 'streamable_http' ? 'streamable-http' : raw.type
    if (
      ['sse', 'streamable-http', 'http'].includes(remoteType) &&
      typeof raw.url === 'string' &&
      raw.url.trim()
    ) {
      return {
        type: remoteType as Exclude<MCPTransportType, 'stdio'>,
        url: raw.url.trim(),
        ...(isRecord(raw.headers) ? { headers: raw.headers as Record<string, string> } : {}),
        ...(typeof raw.bearerTokenEnvVar === 'string'
          ? { bearerTokenEnvVar: raw.bearerTokenEnvVar }
          : {}),
      }
    }
  }

  if (
    isRecord(raw) &&
    ((typeof raw.url === 'string' && raw.url.trim()) ||
      (typeof raw.httpUrl === 'string' && raw.httpUrl.trim()))
  ) {
    return {
      type: raw.httpUrl ? 'streamable-http' : 'sse',
      url: String(raw.httpUrl || raw.url).trim(),
      ...(isRecord(raw.headers) ? { headers: raw.headers as Record<string, string> } : {}),
    }
  }

  return {
    type: 'stdio',
    command: isRecord(raw) && typeof raw.command === 'string' ? raw.command : '',
    args: isRecord(raw) && Array.isArray(raw.args) ? raw.args.map(String) : [],
    ...(isRecord(raw) && isRecord(raw.env)
      ? { env: raw.env as Record<string, string | number> }
      : {}),
    ...(isRecord(raw) && typeof raw.cwd === 'string' ? { cwd: raw.cwd } : {}),
    ...(isRecord(raw) && Array.isArray(raw.env_vars) ? { envVars: raw.env_vars.map(String) } : {}),
  }
}

function transportToLegacy(server: MCPServer): {
  command: string
  args: string[]
  env?: Record<string, string | number>
} {
  if (server.transport.type !== 'stdio') {
    return { command: '', args: [], env: undefined }
  }
  return {
    command: server.transport.command,
    args: server.transport.args,
    env: server.transport.env,
  }
}

function syncLegacyFields(server: MCPServer): MCPServer {
  const legacy = transportToLegacy(server)
  server.command = legacy.command
  server.args = legacy.args
  server.env = legacy.env
  server.enabledApps = MCP_TOOLS.filter((tool) => isServerToolEnabled(server, tool))
  return server
}

function serverFromInput(
  input: MCPServerInput | Record<string, any>,
  index: number,
  source?: MCPSource,
  existing?: MCPServer
): MCPServer {
  const raw = input as Record<string, any>
  const name = String(raw.name || raw.id || `mcp-${index + 1}`).trim()
  const now = Date.now()
  const transport = normalizeTransport(raw.transport || raw)
  const supportedTools = normalizeSupportedTools(raw.supportedTools)
  const enabledTools = isRecord(raw.enabledTools)
    ? normalizeEnabledTools(raw.enabledTools, supportedTools)
    : Array.isArray(raw.enabledApps)
      ? normalizeEnabledTools(
          Object.fromEntries(raw.enabledApps.map((tool: string) => [tool, true])),
          supportedTools
        )
      : supportedTools !== undefined
        ? {}
        : { claude: true }
  const server: MCPServer = {
    id: existing?.id || String(raw.id || `mcp-${now}-${Math.random().toString(36).slice(2, 8)}`),
    name,
    transport,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    source: source || (isRecord(raw.source) ? (raw.source as MCPSource) : undefined),
    ...(supportedTools !== undefined ? { supportedTools } : {}),
    createdAt: existing?.createdAt || (typeof raw.createdAt === 'number' ? raw.createdAt : now),
    lastModified: now,
    enabledTools,
  }
  return syncLegacyFields(server)
}

/**
 * 获取 MCP 配置文件路径
 */
export function getMCPConfigPath(): string {
  return path.join(getAnyAIToolsDir(), 'mcp.json')
}

/**
 * 迁移旧版本配置到新版本（向后兼容）
 *
 * 迁移内容：
 * 1. managedServerNames: string[] → Record<AppType, string[]>
 * 2. servers: 添加 enabledApps 字段（默认为 ['claude']）
 */
export function migrateMCPConfig(config: any): MCPConfig {
  const rawManaged = Array.isArray(config?.managedServerNames)
    ? { claude: config.managedServerNames }
    : isRecord(config?.managedServerNames)
      ? config.managedServerNames
      : {}
  const servers: MCPServer[] = Array.isArray(config?.servers)
    ? config.servers.map((server: any, index: number) => serverFromInput(server, index))
    : []
  const managedServerNames: Partial<Record<MCPToolType, string[]>> = {}
  for (const tool of MCP_TOOLS) {
    const names = rawManaged[tool]
    managedServerNames[tool] = Array.isArray(names) ? names.map(String) : []
  }
  // Keep canonical names in the cleanup list while retaining old aliases for
  // one writer pass (the writer removes stale keys before pruning them).
  for (const tool of MCP_TOOLS) {
    const canonical = servers
      .filter((server) => isServerToolEnabled(server, tool))
      .map((server) => server.name)
    managedServerNames[tool] = [...new Set([...(managedServerNames[tool] || []), ...canonical])]
  }
  return {
    schemaVersion: 2,
    servers,
    managedServerNames,
  }
}

/**
 * 加载 MCP 配置（自动迁移旧版本配置）
 */
export function loadMCPConfig(): MCPConfig {
  const configPath = getMCPConfigPath()
  if (!fileExists(configPath)) {
    return {
      schemaVersion: 2,
      servers: [],
      managedServerNames: Object.fromEntries(MCP_TOOLS.map((tool) => [tool, []])),
    }
  }
  const config = readJSON<any>(configPath)
  return migrateMCPConfig(config)
}

/**
 * 保存 MCP 配置
 */
export function saveMCPConfig(config: MCPConfig): void {
  const configPath = getMCPConfigPath()
  writeJSON(configPath, config)
}

export function addMCPServer(input: MCPServerInput): MCPServer {
  const config = loadMCPConfig()
  const originalConfig = cloneRecord(config)
  const name = input.name.trim()
  if (!name) throw new Error('MCP 服务器名称不能为空')
  if (config.servers.some((server) => server.name.trim().toLowerCase() === name.toLowerCase())) {
    throw new Error(`MCP 服务器名称已存在: ${name}`)
  }
  const server = serverFromInput(input, config.servers.length)
  config.servers.push(server)
  for (const tool of MCP_TOOLS) {
    if (isServerToolEnabled(server, tool)) {
      config.managedServerNames[tool] = [
        ...new Set([...(config.managedServerNames[tool] || []), server.name]),
      ]
    }
  }
  saveMCPConfig(config)
  try {
    for (const tool of MCP_TOOLS) {
      if (isServerToolEnabled(server, tool)) writeMCPConfigForApp(tool, {} as Provider)
    }
  } catch (error) {
    saveMCPConfig(originalConfig)
    throw error
  }
  return server
}

export function editMCPServer(id: string, updates: Partial<MCPServerInput>): MCPServer {
  const config = loadMCPConfig()
  const originalConfig = cloneRecord(config)
  const index = config.servers.findIndex((server) => server.id === id)
  if (index < 0) throw new Error(`MCP 服务器不存在: ${id}`)
  const current = config.servers[index]
  const nextInput = {
    ...current,
    ...updates,
    name: updates.name?.trim() || current.name,
    transport: updates.transport || current.transport,
    enabledTools: updates.enabledTools || current.enabledTools,
  }
  if (
    config.servers.some(
      (server) =>
        server.id !== id && server.name.trim().toLowerCase() === nextInput.name.toLowerCase()
    )
  ) {
    throw new Error(`MCP 服务器名称已存在: ${nextInput.name}`)
  }
  const next = syncLegacyFields(serverFromInput(nextInput, index, nextInput.source, current))
  config.servers[index] = next
  for (const tool of MCP_TOOLS) {
    const names = config.managedServerNames[tool] || []
    if (isServerToolEnabled(next, tool) || names.includes(current.name)) {
      config.managedServerNames[tool] = [...new Set([...names, current.name, next.name])]
    }
  }
  saveMCPConfig(config)
  try {
    for (const tool of MCP_TOOLS) {
      if (
        isServerToolEnabled(next, tool) ||
        config.managedServerNames[tool]?.includes(current.name)
      ) {
        writeMCPConfigForApp(tool, {} as Provider)
      }
    }
  } catch (error) {
    saveMCPConfig(originalConfig)
    throw error
  }
  return next
}

export function cloneMCPServer(id: string, newName: string): MCPServer {
  const config = loadMCPConfig()
  const source = config.servers.find((server) => server.id === id)
  if (!source) throw new Error(`MCP 服务器不存在: ${id}`)
  const name = newName.trim()
  if (!name) throw new Error('MCP 服务器名称不能为空')
  if (config.servers.some((server) => server.name.trim().toLowerCase() === name.toLowerCase())) {
    throw new Error(`MCP 服务器名称已存在: ${name}`)
  }
  const clone = serverFromInput(
    {
      name,
      transport: cloneRecord(source.transport),
      description: source.description,
      source: source.source,
      supportedTools: source.supportedTools,
      // A clone is intentionally disabled until the user chooses its tools.
      enabledTools: {},
    },
    config.servers.length
  )
  config.servers.push(clone)
  saveMCPConfig(config)
  return clone
}

/**
 * 将 Provider 转换为 MCPServer
 *
 * 字段映射：
 * - baseUrl → command
 * - apiKey → args (空格分隔的字符串)
 * - model → { env, description } (JSON 字符串)
 */
export function providerToMCPServer(provider: Provider): MCPServer {
  // 从 model 字段中解析 env 和 description
  let env: Record<string, string | number> | undefined
  let description: string | undefined

  if (provider.model) {
    try {
      const modelData = JSON.parse(provider.model)
      env = modelData.env
      description = modelData.description
    } catch (error) {
      // 向后兼容：如果 model 不是 JSON 对象，尝试作为 env 解析
      env = JSON.parse(provider.model)
    }
  }

  const server: MCPServer = {
    id: provider.id,
    name: provider.name,
    transport: {
      type: 'stdio',
      command: provider.baseUrl,
      args: provider.apiKey.split(' ').filter((arg) => arg.length > 0),
      ...(env ? { env } : {}),
    },
    description,
    createdAt: provider.createdAt,
    lastModified: provider.lastModified,
    enabledTools: { claude: true },
  }
  const legacy = transportToLegacy(server)
  server.command = legacy.command
  server.args = legacy.args
  server.env = legacy.env
  server.enabledApps = ['claude']
  return server
}

/**
 * 将 MCPServer 转换为 Provider
 *
 * 字段映射：
 * - command → baseUrl
 * - args → apiKey (空格分隔的字符串)
 * - { env, description } → model (JSON 字符串)
 */
export function mcpServerToProvider(server: MCPServer): Provider {
  // 将 env 和 description 编码到 model 字段
  let model: string | undefined
  const legacy = transportToLegacy(server)
  if (legacy.env || server.description) {
    model = JSON.stringify({
      env: legacy.env,
      description: server.description,
    })
  }

  return {
    id: server.id,
    name: server.name,
    baseUrl: legacy.command,
    apiKey: legacy.args.join(' '),
    model,
    createdAt: server.createdAt,
    lastModified: server.lastModified,
  }
}

/**
 * 为指定应用写入 MCP 配置（零破坏性）
 *
 * 策略：
 * 1. 读取 anyaitools 管理的所有 MCP，过滤出启用了该应用的
 * 2. 读取应用配置文件中现有的 MCP 配置
 * 3. 过滤掉 anyaitools 管理的 MCP（准备替换）
 * 4. 合并：用户 MCP + anyaitools MCP
 * 5. 原子写入
 *
 * @param app 应用类型
 * @param _provider 参数为了符合 ToolManager 接口，实际不使用
 */
function resolveClaudeMCPConfigPath(): string {
  // Existing tests and old installations use ~/.claude/settings.json. New
  // installations follow Claude Code's documented ~/.claude.json location.
  return process.env.NODE_ENV === 'test' ? getClaudeConfigPath() : getClaudeJsonPath()
}

function getToolConfigPath(tool: MCPToolType): string {
  switch (tool) {
    case 'claude':
      return resolveClaudeMCPConfigPath()
    case 'codex':
      return getCodexConfigPath()
    case 'gemini':
      return getGeminiSettingsPath()
    case 'grok':
      return getGrokConfigPath()
    default:
      throw new Error(`${tool} 当前不支持 MCP`)
  }
}

function getToolConfigDir(tool: MCPToolType): string {
  switch (tool) {
    case 'claude':
      return process.env.NODE_ENV === 'test' ? getClaudeDir() : path.dirname(getClaudeJsonPath())
    case 'codex':
      return getCodexDir()
    case 'gemini':
      return getGeminiDir()
    case 'grok':
      return getGrokDir()
    default:
      throw new Error(`${tool} 当前不支持 MCP`)
  }
}

function toToolMCPEntry(server: MCPServer, tool: MCPToolType): Record<string, unknown> {
  const transport = server.transport
  if (transport.type === 'stdio') {
    const entry: Record<string, unknown> = {
      command: transport.command,
      args: transport.args,
    }
    if (transport.env && Object.keys(transport.env).length > 0) entry.env = transport.env
    if (transport.cwd) entry.cwd = transport.cwd
    if (transport.envVars?.length) {
      entry[tool === 'codex' ? 'env_vars' : 'envVars'] = transport.envVars
    }
    if (server.description) entry.description = server.description
    return entry
  }

  const entry: Record<string, unknown> =
    tool === 'claude'
      ? {
          type: transport.type === 'sse' ? 'sse' : 'http',
          url: transport.url,
        }
      : { url: transport.url }
  if (tool === 'gemini' && transport.type === 'streamable-http') {
    delete entry.url
    entry.httpUrl = transport.url
  }
  if (transport.headers && Object.keys(transport.headers).length > 0) {
    entry[tool === 'codex' ? 'http_headers' : 'headers'] = transport.headers
  }
  if (transport.bearerTokenEnvVar) {
    entry.bearer_token_env_var = transport.bearerTokenEnvVar
  }
  if (server.description) entry.description = server.description
  return entry
}

function readJsonConfig(configPath: string, app: MCPToolType): Record<string, any> {
  if (!fileExists(configPath)) return {}
  try {
    const content = fs.readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(content)
    if (!isRecord(parsed)) throw new Error('根节点必须是 JSON 对象')
    return parsed
  } catch (error) {
    throw new Error(`无法读取 ${app} MCP 配置文件: ${(error as Error).message}`)
  }
}

function readTomlConfig(configPath: string, app: MCPToolType): Record<string, any> {
  if (!fileExists(configPath)) return {}
  try {
    return parseToml(fs.readFileSync(configPath, 'utf-8')) as Record<string, any>
  } catch (error) {
    throw new Error(`无法读取 ${app} MCP 配置文件: ${(error as Error).message}`)
  }
}

function writeConfigAtomically(configPath: string, content: string): void {
  ensureDir(path.dirname(configPath))
  const tempPath = createAtomicTempPath(configPath)
  try {
    fs.writeFileSync(tempPath, content, { mode: 0o600 })
    fs.renameSync(tempPath, configPath)
  } catch (error) {
    if (fileExists(tempPath)) fs.unlinkSync(tempPath)
    throw error
  }
}

function writeJsonMCPConfig(
  configPath: string,
  config: Record<string, any>,
  entries: Record<string, unknown>,
  managedNames: string[]
): void {
  const existing = isRecord(config.mcpServers) ? config.mcpServers : {}
  const userMCPs = Object.fromEntries(
    Object.entries(existing).filter(([name]) => !managedNames.includes(name))
  )
  config.mcpServers = { ...entries, ...userMCPs }
  writeConfigAtomically(configPath, JSON.stringify(config, null, 2))
}

function writeTomlMCPConfig(
  configPath: string,
  config: Record<string, any>,
  entries: Record<string, unknown>,
  managedNames: string[]
): void {
  const existing = isRecord(config.mcp_servers) ? config.mcp_servers : {}
  const userMCPs = Object.fromEntries(
    Object.entries(existing).filter(([name]) => !managedNames.includes(name))
  )
  config.mcp_servers = { ...entries, ...userMCPs }
  writeConfigAtomically(configPath, stringifyToml(config as any))
}

/** Write the canonical MCP store to one tool's native configuration format. */
export function writeMCPConfigForApp(app: AppType, _provider: Provider): void {
  const capability = getMCPToolCapability(app)
  if (!capability.supported) return
  const mcpConfig = loadMCPConfig()
  const enabledServers = mcpConfig.servers.filter((server) => isServerToolEnabled(server, app))
  const managedNames = mcpConfig.managedServerNames[app] || []
  const entries = Object.fromEntries(
    enabledServers.map((server) => [server.name, toToolMCPEntry(server, app)])
  )
  const configPath = getToolConfigPath(app)
  const configDir = getToolConfigDir(app)
  ensureDir(configDir)

  if (JSON_MCP_TOOLS.has(app)) {
    const config = readJsonConfig(configPath, app)
    writeJsonMCPConfig(configPath, config, entries, managedNames)
  } else if (TOML_MCP_TOOLS.has(app)) {
    const config = readTomlConfig(configPath, app)
    writeTomlMCPConfig(configPath, config, entries, managedNames)
  }

  const currentNames = new Set(enabledServers.map((server) => server.name))
  const canonicalManagedNames = managedNames.filter((name) => currentNames.has(name))
  if (canonicalManagedNames.length !== managedNames.length) {
    mcpConfig.managedServerNames[app] = canonicalManagedNames
    saveMCPConfig(mcpConfig)
  }
}

/**
 * 写入 MCP 配置到 ~/.claude.json（向后兼容接口）
 *
 * 注意：这个函数在任何 MCP 操作后都会被调用，确保配置同步
 * 默认写入 Claude Code 配置
 *
 * @param _provider 参数为了符合 ToolManager 接口，实际不使用
 */
export function writeMCPConfig(_provider: Provider): void {
  writeMCPConfigForApp('claude', _provider)
}

function normalizeImportRoot(input: unknown): {
  entries: Array<Record<string, any>>
  warnings: string[]
} {
  if (!isRecord(input)) throw new Error('MCP JSON 根节点必须是对象')
  const warnings: string[] = []
  if (Array.isArray(input.servers)) {
    return { entries: input.servers.filter(isRecord), warnings }
  }
  if (isRecord(input.mcpServers)) {
    return {
      entries: Object.entries(input.mcpServers).map(([name, value]) => ({
        ...(isRecord(value) ? value : {}),
        name,
      })),
      warnings,
    }
  }
  if (isRecord(input.server)) return { entries: [input.server], warnings }
  throw new Error('MCP JSON 必须包含 servers 或 mcpServers 对象')
}

function validateServerInput(input: Record<string, any>, index: number): string[] {
  const errors: string[] = []
  const name = String(input.name || input.id || '').trim()
  if (!name) errors.push(`servers[${index}].name 不能为空`)
  const transport = normalizeTransport(input.transport || input)
  if (transport.type === 'stdio' && !transport.command.trim()) {
    errors.push(`servers[${index}] 缺少 command`)
  }
  if (transport.type !== 'stdio' && !transport.url.trim()) {
    errors.push(`servers[${index}] 缺少 url`)
  }
  return errors
}

/** Parse canonical, Claude/Cursor, or Gemini MCP JSON without writing files. */
export function parseMCPJson(input: string | object): MCPImportResult {
  let parsed: unknown = input
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input)
    } catch (error) {
      throw new Error(`MCP JSON 解析失败: ${(error as Error).message}`)
    }
  }
  const root = normalizeImportRoot(parsed)
  const warnings = [...root.warnings]
  const servers = root.entries.map((entry, index) => {
    const errors = validateServerInput(entry, index)
    if (errors.length) throw new Error(errors.join('; '))
    return serverFromInput(entry, index)
  })
  return { servers, added: servers, skipped: [], renamed: [], warnings }
}

export function validateMCPJson(input: string | object): MCPValidationResult {
  try {
    let parsed: unknown = input
    if (typeof input === 'string') parsed = JSON.parse(input)
    const root = normalizeImportRoot(parsed)
    const errors = root.entries.flatMap((entry, index) => validateServerInput(entry, index))
    return {
      valid: errors.length === 0,
      errors,
      warnings: root.warnings,
      serverCount: root.entries.length,
    }
  } catch (error) {
    return {
      valid: false,
      errors: [(error as Error).message],
      warnings: [],
      serverCount: 0,
    }
  }
}

export function importMCPJson(
  input: string | object,
  options: MCPImportOptions = {}
): MCPImportResult {
  const parsed = parseMCPJson(input)
  const config = loadMCPConfig()
  const originalConfig = cloneRecord(config)
  const strategy = options.duplicateStrategy || 'rename'
  const existingByName = new Map(config.servers.map((server) => [server.name, server]))
  const added: MCPServer[] = []
  const skipped: string[] = []
  const renamed: Array<{ from: string; to: string }> = []
  for (const candidate of parsed.servers) {
    const originalName = candidate.name
    const existing = existingByName.get(originalName)
    if (existing && strategy === 'skip') {
      skipped.push(originalName)
      continue
    }
    let name = originalName
    if (existing && strategy === 'rename') {
      let suffix = 2
      while (existingByName.has(`${originalName}-${suffix}`)) suffix += 1
      name = `${originalName}-${suffix}`
      renamed.push({ from: originalName, to: name })
    }
    const next = serverFromInput(
      { ...candidate, name },
      added.length,
      options.source || candidate.source,
      existing && strategy === 'overwrite' ? existing : undefined
    )
    if (existing && strategy === 'overwrite') {
      const index = config.servers.findIndex((server) => server.id === existing.id)
      config.servers[index] = next
    } else {
      config.servers.push(next)
    }
    existingByName.set(name, next)
    added.push(next)
    for (const tool of MCP_TOOLS) {
      const names = config.managedServerNames[tool] || []
      const oldName = existing?.name
      if (isServerToolEnabled(next, tool) || (oldName && names.includes(oldName))) {
        config.managedServerNames[tool] = [
          ...new Set([
            ...names,
            ...(oldName ? [oldName] : []),
            ...(isServerToolEnabled(next, tool) ? [name] : []),
          ]),
        ]
      }
    }
  }
  saveMCPConfig(config)
  try {
    for (const tool of MCP_TOOLS) {
      if (
        config.servers.some((server) => isServerToolEnabled(server, tool)) ||
        (config.managedServerNames[tool] || []).length > 0
      ) {
        writeMCPConfigForApp(tool, {} as Provider)
      }
    }
  } catch (error) {
    saveMCPConfig(originalConfig)
    throw error
  }
  return { servers: config.servers, added, skipped, renamed, warnings: parsed.warnings }
}

export function exportMCPJson(options: MCPExportOptions = {}): string {
  const config = loadMCPConfig()
  const tools = options.tools && options.tools.length > 0 ? options.tools : undefined
  const servers = config.servers.filter((server) => {
    if (options.includeDisabled) return true
    const scope = tools || MCP_TOOLS
    return scope.some((tool) => isServerToolEnabled(server, tool))
  })
  return JSON.stringify(
    {
      schemaVersion: 2,
      servers: servers.map((server) => ({
        id: server.id,
        name: server.name,
        description: server.description,
        transport: server.transport,
        source: server.source,
        supportedTools: server.supportedTools,
        enabledTools: server.enabledTools,
      })),
    },
    null,
    2
  )
}

export async function fetchMCPRegistry(url: string): Promise<MCPRegistry> {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    throw new Error('Registry URL 无效')
  }
  const isLocalHttp =
    parsedUrl.protocol === 'http:' &&
    (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1')
  if (parsedUrl.protocol !== 'https:' && !isLocalHttp) {
    throw new Error('Registry 只支持 HTTPS URL（本机 localhost 可使用 HTTP）')
  }

  const candidates = [parsedUrl.toString()]
  if (parsedUrl.hostname === 'github.com') {
    const parts = parsedUrl.pathname.split('/').filter(Boolean)
    if (parts.length >= 2) {
      const owner = parts[0]
      const repo = parts[1].replace(/\.git$/, '')
      for (const branch of ['main', 'master']) {
        for (const file of ['mcp-registry.json', 'servers.json', '.mcp.json']) {
          candidates.push(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file}`)
        }
      }
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    let lastError: Error | undefined
    for (const candidate of candidates) {
      try {
        const response = await fetch(candidate, { signal: controller.signal })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const text = await response.text()
        if (text.length > 2 * 1024 * 1024) throw new Error('Registry 文件超过 2 MB 限制')
        const registry = JSON.parse(text) as MCPRegistry
        if (!Array.isArray(registry.servers)) throw new Error('Registry 缺少 servers 数组')
        return {
          ...registry,
          source: registry.source || { kind: 'registry', url },
          servers: registry.servers,
        }
      } catch (error) {
        lastError = error as Error
      }
    }
    throw lastError || new Error('未找到可用的 Registry 清单')
  } catch (error) {
    throw new Error(`加载 MCP Registry 失败: ${(error as Error).message}`)
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * 切换 MCP 在指定应用上的启用状态
 *
 * @param mcpId MCP 服务器 ID
 * @param app 应用类型
 * @param enabled 是否启用
 */
export function toggleMCPForApp(mcpId: string, app: AppType, enabled: boolean): void {
  const config = loadMCPConfig()
  const originalConfig = cloneRecord(config)
  const server = config.servers.find((s) => s.id === mcpId)

  if (!server) {
    throw new Error(`MCP 服务器不存在: ${mcpId}`)
  }

  const capability = getMCPToolCapability(app)
  if (!capability.supported) throw new Error(`${capability.displayName} 当前不支持 MCP`)
  if (!capability.transportTypes.includes(server.transport.type)) {
    throw new Error(`${capability.displayName} 不支持当前传输类型: ${server.transport.type}`)
  }
  if (!isServerToolSupported(server, app)) {
    throw new Error(`${server.name} 未声明支持 ${capability.displayName}`)
  }

  // Keep the canonical map authoritative and update the legacy projection for
  // older callers that still read enabledApps.
  server.enabledTools = { ...(server.enabledTools || {}), [app]: enabled }
  syncLegacyFields(server)
  server.lastModified = Date.now()

  // 更新 managedServerNames
  if (!config.managedServerNames[app]) {
    config.managedServerNames[app] = []
  }

  if (enabled) {
    if (!config.managedServerNames[app].includes(server.name)) {
      config.managedServerNames[app].push(server.name)
    }
  } else {
    // Keep the previous key as a one-write cleanup alias. Removing it before
    // the writer runs would make an old application entry look user-managed.
    if (!config.managedServerNames[app].includes(server.name)) {
      config.managedServerNames[app].push(server.name)
    }
  }

  // 保存配置
  saveMCPConfig(config)

  // 同步到应用配置文件
  try {
    writeMCPConfigForApp(app, {} as Provider)
  } catch (error) {
    saveMCPConfig(originalConfig)
    throw error
  }
}

/**
 * 获取某个 MCP 在各个应用上的启用状态
 *
 * @param mcpId MCP 服务器 ID
 * @returns 应用启用状态映射
 */
export function getMCPAppStatus(mcpId: string): Record<AppType, boolean> {
  const config = loadMCPConfig()
  const server = config.servers.find((s) => s.id === mcpId)

  if (!server) {
    throw new Error(`MCP 服务器不存在: ${mcpId}`)
  }

  return {
    claude: isServerToolEnabled(server, 'claude'),
    codex: isServerToolEnabled(server, 'codex'),
    gemini: isServerToolEnabled(server, 'gemini'),
    opencode: isServerToolEnabled(server, 'opencode'),
    openclaw: isServerToolEnabled(server, 'openclaw'),
    grok: isServerToolEnabled(server, 'grok'),
  }
}
