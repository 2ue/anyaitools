import { getAnyAIToolsDir, getMCPRegistryCachePath, getMCPRegistrySourcesPath } from './paths.js'
import { ensureDir, fileExists, readJSON, writeJSON } from './utils/file.js'
import type {
  MCPRegistryEntry,
  MCPRegistryParser,
  MCPRegistryQuery,
  MCPRegistrySnapshot,
  MCPRegistrySource,
  MCPRegistrySourceInput,
  MCPServerInput,
  MCPTransport,
  MCPTransportType,
} from '@anyaitools/types'

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const COMMUNITY_CATALOG_MAX_RESPONSE_BYTES = 12 * 1024 * 1024
const DEFAULT_TIMEOUT_MS = 10000

const BUILTIN_SOURCES: MCPRegistrySource[] = [
  {
    id: 'official-mcp-registry',
    name: '官方 MCP Registry',
    kind: 'official-api',
    url: 'https://registry.modelcontextprotocol.io/v0/servers?limit=100',
    description: 'Model Context Protocol 官方发布目录',
    builtIn: true,
    enabled: true,
    parser: 'official-registry',
  },
  {
    id: 'official-reference-servers',
    name: '官方参考服务器',
    kind: 'github',
    url: 'https://github.com/modelcontextprotocol/servers',
    description: '官方维护的 MCP 参考实现和示例服务器',
    builtIn: true,
    enabled: true,
    parser: 'github-readme',
  },
  {
    id: 'tensorblock-community-catalog',
    name: 'TensorBlock 社区目录',
    kind: 'json',
    url: 'https://raw.githubusercontent.com/TensorBlock/awesome-mcp-servers/main/data/catalog.json',
    description: '社区维护的 MCP 服务器目录',
    builtIn: true,
    enabled: true,
    parser: 'community-catalog',
    maxResponseBytes: COMMUNITY_CATALOG_MAX_RESPONSE_BYTES,
  },
]

interface RegistryCacheFile {
  snapshots: MCPRegistrySnapshot[]
}

interface OfficialRegistryResponse {
  servers?: Array<{
    server?: Record<string, any>
    _meta?: Record<string, any>
  }>
  metadata?: { nextCursor?: string }
}

interface CommunityCatalogEntry {
  id?: string
  name?: string
  description?: string
  links?: Record<string, unknown>
  install?: { commands?: unknown[]; env?: unknown[]; confidence?: unknown }
  transport?: unknown
  auth?: { type?: unknown; notes?: unknown[] }
  tools?: { count?: unknown }
  category?: unknown
  license?: string
}

function isAllowedRegistryUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return (
      parsed.protocol === 'https:' ||
      (parsed.protocol === 'http:' &&
        (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'))
    )
  } catch {
    return false
  }
}

export function listBuiltInMCPRegistrySources(): MCPRegistrySource[] {
  return BUILTIN_SOURCES.map((source) => ({ ...source }))
}

function normalizeSourceInput(input: MCPRegistrySourceInput, index: number): MCPRegistrySource {
  const url = input.url.trim()
  if (!url) throw new Error('Registry URL 不能为空')
  if (!isAllowedRegistryUrl(url)) {
    try {
      new URL(url)
    } catch {
      throw new Error('Registry URL 无效')
    }
    throw new Error('Registry 只允许 HTTPS，或 localhost/127.0.0.1 的 HTTP')
  }
  const kind = input.kind
  const parser: MCPRegistryParser =
    input.parser ||
    (kind === 'official-api'
      ? 'official-registry'
      : kind === 'github'
        ? 'github-readme'
        : 'generic-json')
  return {
    id: `custom-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    name: input.name.trim() || url,
    kind,
    url,
    description: input.description?.trim() || undefined,
    builtIn: false,
    enabled: input.enabled !== false,
    parser,
  }
}

export function loadMCPRegistrySources(): MCPRegistrySource[] {
  let custom: MCPRegistrySource[] = []
  if (fileExists(getMCPRegistrySourcesPath())) {
    try {
      const parsed = readJSON<{ sources?: MCPRegistrySource[] }>(getMCPRegistrySourcesPath())
      custom = Array.isArray(parsed.sources)
        ? parsed.sources.filter((source): source is MCPRegistrySource =>
            Boolean(
              source &&
              typeof source.id === 'string' &&
              typeof source.name === 'string' &&
              typeof source.url === 'string' &&
              isAllowedRegistryUrl(source.url)
            )
          )
        : []
    } catch {
      custom = []
    }
  }
  const customById = new Map(custom.map((source) => [source.id, source]))
  return [
    ...BUILTIN_SOURCES.map((source) => ({
      ...source,
      ...(customById.get(source.id) || {}),
      builtIn: true,
    })),
    ...custom.filter((source) => !BUILTIN_SOURCES.some((builtIn) => builtIn.id === source.id)),
  ]
}

function saveCustomMCPRegistrySources(sources: MCPRegistrySource[]): void {
  ensureDir(getAnyAIToolsDir())
  writeJSON(getMCPRegistrySourcesPath(), {
    schemaVersion: 1,
    sources: sources.filter((source) => !source.builtIn),
  })
}

export function addMCPRegistrySource(input: MCPRegistrySourceInput): MCPRegistrySource {
  const source = normalizeSourceInput(input, loadMCPRegistrySources().length)
  const sources = loadMCPRegistrySources()
  if (sources.some((item) => item.url === source.url || item.name === source.name)) {
    throw new Error(`Registry 来源已存在: ${source.name}`)
  }
  saveCustomMCPRegistrySources([...sources, source])
  return source
}

export function removeMCPRegistrySource(id: string): void {
  const source = loadMCPRegistrySources().find((item) => item.id === id)
  if (!source) throw new Error(`Registry 来源不存在: ${id}`)
  if (source.builtIn) throw new Error('内置 Registry 来源不能删除')
  saveCustomMCPRegistrySources(loadMCPRegistrySources().filter((item) => item.id !== id))
}

function readRegistryCache(): RegistryCacheFile {
  if (!fileExists(getMCPRegistryCachePath())) return { snapshots: [] }
  try {
    const cache = readJSON<RegistryCacheFile>(getMCPRegistryCachePath())
    return { snapshots: Array.isArray(cache.snapshots) ? cache.snapshots : [] }
  } catch {
    return { snapshots: [] }
  }
}

function saveRegistryCache(cache: RegistryCacheFile): void {
  ensureDir(getAnyAIToolsDir())
  writeJSON(getMCPRegistryCachePath(), cache)
}

function toSourceRef(source: MCPRegistrySource): {
  kind: 'registry' | 'json' | 'github'
  url: string
} {
  return {
    kind: source.kind === 'github' ? 'github' : source.kind === 'json' ? 'json' : 'registry',
    url: source.url,
  }
}

function inferTransportType(value: unknown): MCPTransportType | undefined {
  if (typeof value === 'string') {
    if (value === 'sse' || value === 'streamable-http' || value === 'http' || value === 'stdio') {
      return value
    }
  }
  return undefined
}

function makeEntry(
  source: MCPRegistrySource,
  input: {
    id?: string
    name: string
    description?: string
    category?: string
    authType?: string
    toolCount?: number
    installConfidence?: string
    repository?: string
    documentationUrl?: string
    license?: string
    transport?: MCPTransport
    envRequirements?: string[]
    warnings?: string[]
    server?: MCPServerInput
  }
): MCPRegistryEntry {
  const server = input.server
  return {
    id: input.id || `${source.id}:${input.name}`,
    name: input.name,
    description: input.description,
    category: input.category,
    authType: input.authType,
    toolCount: input.toolCount,
    installConfidence: input.installConfidence,
    repository: input.repository,
    documentationUrl: input.documentationUrl,
    license: input.license,
    transportType: input.transport?.type || server?.transport.type,
    supportedTools: server?.supportedTools,
    envRequirements: input.envRequirements,
    warnings: input.warnings || [],
    sourceId: source.id,
    sourceUrl: source.url,
    installable: Boolean(server),
    server,
  }
}

function officialServerToEntry(
  source: MCPRegistrySource,
  wrapper: Record<string, any>
): MCPRegistryEntry {
  const raw = wrapper.server || {}
  const warnings: string[] = []
  const repository =
    typeof raw.repository === 'string'
      ? raw.repository
      : raw.repository && typeof raw.repository.url === 'string'
        ? raw.repository.url
        : undefined
  const remotes = Array.isArray(raw.remotes) ? raw.remotes : []
  const remote = remotes.find((item: any) => item && typeof item.url === 'string')
  const packages = Array.isArray(raw.packages) ? raw.packages : []
  const pkg = packages.find((item: any) => item?.transport?.type === 'stdio')
  let transport: MCPTransport | undefined
  let server: MCPServerInput | undefined
  if (remote) {
    const type = inferTransportType(remote.type)
    if (type && type !== 'stdio') {
      transport = { type, url: remote.url }
      server = {
        name: String(raw.name || raw.title || 'mcp-server'),
        transport,
        description: typeof raw.description === 'string' ? raw.description : undefined,
        source: {
          ...toSourceRef(source),
          version: typeof raw.version === 'string' ? raw.version : undefined,
        },
      }
    }
  } else if (pkg && typeof pkg.identifier === 'string') {
    const registryType = String(pkg.registryType || 'npm').toLowerCase()
    const packageConfig =
      registryType === 'npm'
        ? { command: 'npx', args: ['-y', pkg.identifier] }
        : registryType === 'pypi'
          ? { command: 'uvx', args: [pkg.identifier] }
          : registryType === 'docker'
            ? { command: 'docker', args: ['run', '--rm', pkg.identifier] }
            : undefined
    if (packageConfig) {
      transport = { type: 'stdio', ...packageConfig }
      server = {
        name: String(raw.name || raw.title || pkg.identifier),
        transport,
        description: typeof raw.description === 'string' ? raw.description : undefined,
        source: {
          ...toSourceRef(source),
          version: typeof raw.version === 'string' ? raw.version : undefined,
        },
      }
    } else {
      warnings.push(`暂不支持官方 Registry package 类型: ${registryType}`)
    }
  } else {
    warnings.push('目录条目没有可直接转换的 remote 或 package 配置')
  }
  const envRequirements = packages.flatMap((item: any) =>
    Array.isArray(item?.environmentVariables)
      ? item.environmentVariables
          .map((variable: any) => String(variable?.name || ''))
          .filter(Boolean)
      : []
  )
  return makeEntry(source, {
    id: `${source.id}:${String(raw.name || raw.title || Math.random())}`,
    name: String(raw.title || raw.name || 'MCP server'),
    description: typeof raw.description === 'string' ? raw.description : undefined,
    category: typeof raw.category === 'string' ? raw.category : undefined,
    authType: typeof raw.auth?.type === 'string' ? raw.auth.type : undefined,
    toolCount: typeof raw.tools?.count === 'number' ? raw.tools.count : undefined,
    repository,
    documentationUrl: typeof raw.websiteUrl === 'string' ? raw.websiteUrl : undefined,
    transport,
    envRequirements,
    warnings,
    server,
  })
}

function parseOfficialRegistry(source: MCPRegistrySource, value: unknown): MCPRegistrySnapshot {
  const response = value as OfficialRegistryResponse
  const latestByName = new Map<string, NonNullable<OfficialRegistryResponse['servers']>[number]>()
  for (const wrapper of response.servers || []) {
    const name = String(wrapper?.server?.name || wrapper?.server?.title || '')
    if (!name) continue
    const existing = latestByName.get(name)
    const currentIsLatest =
      wrapper?._meta?.['io.modelcontextprotocol.registry/official']?.isLatest === true
    const existingIsLatest =
      existing?._meta?.['io.modelcontextprotocol.registry/official']?.isLatest === true
    if (!existing || (currentIsLatest && !existingIsLatest)) {
      latestByName.set(name, wrapper)
    }
  }
  const entries = [...latestByName.values()].map((wrapper) =>
    officialServerToEntry(source, wrapper || {})
  )
  return {
    source,
    entries,
    fetchedAt: Date.now(),
    stale: false,
    nextCursor: response.metadata?.nextCursor,
  }
}

function parseCommunityCatalog(source: MCPRegistrySource, value: unknown): MCPRegistrySnapshot {
  const rows = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as any).servers)
      ? (value as any).servers
      : []
  const entries = (rows as CommunityCatalogEntry[]).flatMap((row, index) => {
    if (!row || typeof row.name !== 'string') return []
    const commands = Array.isArray(row.install?.commands)
      ? row.install.commands.map(String).filter(Boolean)
      : []
    const endpoint =
      typeof row.links?.endpoint === 'string' ? String(row.links.endpoint) : undefined
    const warnings: string[] = []
    let server: MCPServerInput | undefined
    let transport: MCPTransport | undefined
    if (endpoint) {
      transport = { type: 'streamable-http', url: endpoint }
      server = {
        name: row.name,
        transport,
        description: row.description,
        source: toSourceRef(source),
      }
    } else if (commands.length > 0) {
      const [command, ...args] = splitCommandLine(commands[0])
      transport = { type: 'stdio', command, args }
      server = {
        name: row.name,
        transport,
        description: row.description,
        source: toSourceRef(source),
      }
    } else {
      warnings.push('社区目录没有明确的 endpoint 或 install command')
    }
    return [
      makeEntry(source, {
        id: row.id || `${source.id}:${index}:${row.name}`,
        name: row.name,
        description: row.description,
        category: typeof (row as any).category === 'string' ? (row as any).category : undefined,
        authType: typeof row.auth?.type === 'string' ? String((row.auth as any).type) : undefined,
        toolCount:
          typeof (row as any).tools?.count === 'number' ? (row as any).tools.count : undefined,
        installConfidence:
          typeof row.install?.confidence === 'string' ? row.install.confidence : undefined,
        repository: typeof row.links?.repo === 'string' ? row.links.repo : undefined,
        documentationUrl:
          typeof row.links?.docs === 'string'
            ? row.links.docs
            : typeof row.links?.primary === 'string'
              ? row.links.primary
              : undefined,
        license: row.license,
        transport,
        envRequirements: Array.isArray(row.install?.env) ? row.install?.env.map(String) : undefined,
        warnings,
        server,
      }),
    ]
  })
  return { source, entries, fetchedAt: Date.now(), stale: false }
}

function splitCommandLine(commandLine: string): string[] {
  const tokens: string[] = []
  const tokenPattern = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^']*)'|(\S+)/g
  let match: RegExpExecArray | null
  while ((match = tokenPattern.exec(commandLine))) {
    tokens.push(match[1] ?? match[2] ?? match[3])
  }
  return tokens
}

function canonicalServerFromRegistryItem(item: any, name: string): MCPServerInput | undefined {
  if (item?.transport && typeof item.transport === 'object') {
    const rawTransport = item.transport
    if (rawTransport.type === 'stdio' && typeof rawTransport.command === 'string') {
      return {
        ...item,
        name,
        transport: {
          type: 'stdio',
          command: rawTransport.command,
          args: Array.isArray(rawTransport.args) ? rawTransport.args.map(String) : [],
          ...(rawTransport.env && typeof rawTransport.env === 'object'
            ? { env: rawTransport.env }
            : {}),
        },
      } as MCPServerInput
    }
    if (
      ['sse', 'streamable-http', 'http'].includes(rawTransport.type) &&
      typeof rawTransport.url === 'string' &&
      rawTransport.url.trim()
    ) {
      return {
        ...item,
        name,
        transport: {
          type: rawTransport.type,
          url: rawTransport.url.trim(),
          ...(rawTransport.headers && typeof rawTransport.headers === 'object'
            ? { headers: rawTransport.headers }
            : {}),
        },
      } as MCPServerInput
    }
    return undefined
  }
  if (typeof item?.command === 'string' && item.command.trim()) {
    return {
      name,
      description: typeof item.description === 'string' ? item.description : undefined,
      source: item.source,
      supportedTools: item.supportedTools,
      transport: {
        type: 'stdio',
        command: item.command.trim(),
        args: Array.isArray(item.args) ? item.args.map(String) : [],
        env: item.env && typeof item.env === 'object' ? item.env : undefined,
        cwd: typeof item.cwd === 'string' ? item.cwd : undefined,
      },
    }
  }
  const remoteUrl =
    typeof item?.url === 'string'
      ? item.url
      : typeof item?.httpUrl === 'string'
        ? item.httpUrl
        : undefined
  if (remoteUrl) {
    const type =
      item.type === 'sse'
        ? 'sse'
        : item.type === 'http'
          ? 'http'
          : item.type === 'streamable-http'
            ? 'streamable-http'
            : typeof item.httpUrl === 'string'
              ? 'streamable-http'
              : 'sse'
    return {
      name,
      description: typeof item.description === 'string' ? item.description : undefined,
      source: item.source,
      supportedTools: item.supportedTools,
      transport: {
        type,
        url: remoteUrl,
        headers: item.headers && typeof item.headers === 'object' ? item.headers : undefined,
      },
    } as MCPServerInput
  }
  return undefined
}

function parseGenericRegistry(source: MCPRegistrySource, value: unknown): MCPRegistrySnapshot {
  const root = value as any
  const servers = Array.isArray(root?.servers)
    ? root.servers
    : root?.mcpServers && typeof root.mcpServers === 'object'
      ? Object.entries(root.mcpServers).map(([name, entry]) => ({
          ...(entry as Record<string, unknown>),
          name,
        }))
      : Array.isArray(root)
        ? root
        : []
  const entries = servers.flatMap((item: any, index: number) => {
    try {
      const name = String(item?.name || item?.id || `mcp-${index + 1}`)
      const server = canonicalServerFromRegistryItem(item, name)
      return [
        makeEntry(source, {
          id: `${source.id}:${index}:${name}`,
          name,
          description: typeof item?.description === 'string' ? item.description : undefined,
          category: typeof item?.category === 'string' ? item.category : undefined,
          authType: typeof item?.auth?.type === 'string' ? item.auth.type : undefined,
          toolCount: typeof item?.tools?.count === 'number' ? item.tools.count : undefined,
          installConfidence:
            typeof item?.install?.confidence === 'string' ? item.install.confidence : undefined,
          repository: typeof item?.repository === 'string' ? item.repository : undefined,
          transport: server?.transport,
          warnings: server ? [] : ['条目缺少 canonical transport'],
          server,
        }),
      ]
    } catch {
      return []
    }
  })
  return { source, entries, fetchedAt: Date.now(), stale: false }
}

function parseGitHubReadme(source: MCPRegistrySource, text: string): MCPRegistrySnapshot {
  const entries: MCPRegistryEntry[] = []
  const referencePattern = /^-\s+\*\*\[([^\]]+)\]\(([^)]+)\)\*{0,2}\s+-\s+(.+)$/gm
  let match: RegExpExecArray | null
  while ((match = referencePattern.exec(text))) {
    entries.push(
      makeEntry(source, {
        id: `${source.id}:${match[1]}`,
        name: match[1],
        description: match[3],
        repository: new URL(match[2], `${source.url.replace(/\/+$/, '')}/`).toString(),
        documentationUrl: new URL(match[2], `${source.url.replace(/\/+$/, '')}/`).toString(),
        warnings: ['官方 README 仅提供参考实现链接，需要手动确认可安装配置'],
      })
    )
  }
  return {
    source,
    entries,
    fetchedAt: Date.now(),
    stale: false,
  }
}

async function fetchText(url: string, maxResponseBytes = MAX_RESPONSE_BYTES): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const text = await response.text()
    if (Buffer.byteLength(text, 'utf8') > maxResponseBytes) {
      throw new Error(`Registry 文件超过 ${Math.round(maxResponseBytes / 1024 / 1024)} MB 限制`)
    }
    return text
  } finally {
    clearTimeout(timer)
  }
}

async function fetchOfficialRegistry(source: MCPRegistrySource): Promise<OfficialRegistryResponse> {
  const firstUrl = new URL(source.url)
  const pages: NonNullable<OfficialRegistryResponse['servers']> = []
  let nextUrl: URL | undefined = firstUrl
  let nextCursor: string | undefined

  for (let page = 0; nextUrl && page < 5; page += 1) {
    const response = JSON.parse(
      await fetchText(nextUrl.toString(), source.maxResponseBytes)
    ) as OfficialRegistryResponse
    if (Array.isArray(response.servers)) pages.push(...response.servers)
    const cursor = response.metadata?.nextCursor
    nextCursor = cursor
    if (!cursor) {
      nextUrl = undefined
      continue
    }
    nextUrl = new URL(firstUrl.toString())
    nextUrl.searchParams.set('cursor', cursor)
  }

  return { servers: pages, metadata: nextCursor ? { nextCursor } : undefined }
}

function sourceFetchUrl(source: MCPRegistrySource): string {
  if (source.parser === 'github-readme' && source.url.includes('github.com/')) {
    const url = new URL(source.url)
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length >= 2) {
      return `https://raw.githubusercontent.com/${parts[0]}/${parts[1]}/main/README.md`
    }
  }
  return source.url
}

export async function refreshMCPRegistrySource(id: string): Promise<MCPRegistrySnapshot> {
  const source = loadMCPRegistrySources().find((item) => item.id === id)
  if (!source) throw new Error(`Registry 来源不存在: ${id}`)
  const now = Date.now()
  try {
    const parsed =
      source.parser === 'official-registry'
        ? parseOfficialRegistry(source, await fetchOfficialRegistry(source))
        : (() => {
            const textPromise = fetchText(sourceFetchUrl(source), source.maxResponseBytes)
            return textPromise.then((text) =>
              source.parser === 'github-readme'
                ? parseGitHubReadme(source, text)
                : source.parser === 'community-catalog'
                  ? parseCommunityCatalog(source, JSON.parse(text))
                  : parseGenericRegistry(source, JSON.parse(text))
            )
          })()
    const snapshot = await parsed
    const updated = { ...source, lastFetchedAt: now, lastSuccessAt: now, lastError: undefined }
    const snapshots = readRegistryCache().snapshots.filter((item) => item.source.id !== id)
    saveRegistryCache({
      snapshots: [...snapshots, { ...snapshot, source: updated }],
    })
    if (!source.builtIn) {
      saveCustomMCPRegistrySources(
        loadMCPRegistrySources().map((item) => (item.id === id ? updated : item))
      )
    }
    return { ...snapshot, source: updated }
  } catch (error) {
    const cached = readRegistryCache().snapshots.find((item) => item.source.id === id)
    const updated = { ...source, lastFetchedAt: now, lastError: (error as Error).message }
    if (!source.builtIn) {
      saveCustomMCPRegistrySources(
        loadMCPRegistrySources().map((item) => (item.id === id ? updated : item))
      )
    }
    if (cached) {
      return { ...cached, source: updated, stale: true, error: updated.lastError }
    }
    return { source: updated, entries: [], stale: true, error: updated.lastError }
  }
}

export async function refreshAllMCPRegistrySources(): Promise<MCPRegistrySnapshot[]> {
  const sources = loadMCPRegistrySources().filter((source) => source.enabled)
  return Promise.all(sources.map((source) => refreshMCPRegistrySource(source.id)))
}

export function getCachedMCPRegistrySnapshots(): MCPRegistrySnapshot[] {
  const cache = readRegistryCache()
  return loadMCPRegistrySources()
    .filter((source) => source.enabled)
    .map((source) => {
      const snapshot = cache.snapshots.find((item) => item.source.id === source.id)
      return snapshot || { source, entries: [], stale: true }
    })
}

export async function searchMCPRegistry(
  query: MCPRegistryQuery = {}
): Promise<MCPRegistrySnapshot[]> {
  const snapshots = query.refresh
    ? await refreshAllMCPRegistrySources()
    : getCachedMCPRegistrySnapshots()
  const needle = query.query?.trim().toLowerCase()
  return snapshots
    .filter((snapshot) => !query.sourceIds?.length || query.sourceIds.includes(snapshot.source.id))
    .map((snapshot) => ({
      ...snapshot,
      entries: snapshot.entries.filter((entry) => {
        if (query.installableOnly && !entry.installable) return false
        if (
          query.transportTypes?.length &&
          (!entry.transportType || !query.transportTypes.includes(entry.transportType))
        ) {
          return false
        }
        if (!needle) return true
        return [entry.name, entry.description, entry.repository, entry.documentationUrl]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle))
      }),
    }))
}
