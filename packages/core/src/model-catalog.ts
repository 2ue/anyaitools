import * as fs from 'node:fs'
import * as path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { getAnyAIToolsDir } from './paths.js'
import type {
  ModelCatalog,
  ModelCatalogEntry,
  ModelCatalogRequest,
  ModelCatalogSource,
  ModelToolType,
  Provider,
} from '@anyaitools/types'
import { resolveProviderModel } from './model-config.js'

const execFileAsync = promisify(execFile)
const CACHE_FILE = 'model-catalogs.json'
const REQUEST_TIMEOUT_MS = 8_000

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  return [...new Set(values.filter((value): value is string => typeof value === 'string'))]
}

const SENSITIVE_KEYS = /(?:api[_-]?key|authorization|token|secret|password|credential)/i

function sanitizeCapabilities(value: unknown): JsonRecord | undefined {
  if (!isRecord(value)) return undefined
  const sanitized: JsonRecord = {}
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEYS.test(key)) continue
    if (isRecord(child)) {
      sanitized[key] = sanitizeCapabilities(child) || {}
    } else if (Array.isArray(child)) {
      sanitized[key] = child.map((item) =>
        isRecord(item) ? sanitizeCapabilities(item) || {} : item
      )
    } else {
      sanitized[key] = child
    }
  }
  return sanitized
}

function inferReasoning(value: JsonRecord): ModelCatalogEntry['reasoning'] | undefined {
  const efforts =
    uniqueStrings(value.supportedReasoningEfforts).length > 0
      ? uniqueStrings(value.supportedReasoningEfforts)
      : uniqueStrings(value.reasoningEfforts)

  if (efforts.length > 0) {
    return { mode: 'effort', supportedValues: efforts }
  }

  if (isRecord(value.thinkingConfig) || isRecord(value.thinking)) {
    return { mode: 'thinking' }
  }

  if (value.thinkingBudget !== undefined) {
    return { mode: 'budget' }
  }

  return undefined
}

function inferVariants(value: JsonRecord): string[] {
  if (!isRecord(value.variants)) return []
  return Object.keys(value.variants)
}

function normalizeEntries(
  payload: unknown,
  source: ModelCatalogSource,
  providerId?: string
): ModelCatalogEntry[] {
  const rows: unknown[] = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.data)
      ? payload.data
      : isRecord(payload) && Array.isArray(payload.models)
        ? payload.models
        : isRecord(payload) && isRecord(payload.models)
          ? Object.entries(payload.models).map(([id, value]) => ({
              ...(isRecord(value) ? value : {}),
              id,
            }))
          : isRecord(payload)
            ? Object.entries(payload).map(([id, value]) => ({
                ...(isRecord(value) ? value : {}),
                id,
              }))
            : []

  const entries: ModelCatalogEntry[] = []
  for (const row of rows) {
    if (typeof row === 'string') {
      entries.push({ id: row, source, providerId })
      continue
    }
    if (!isRecord(row)) continue

    const id = asString(row.id) || asString(row.name) || asString(row.model)
    if (!id) continue
    entries.push({
      id: id.replace(/^models\//, ''),
      name: asString(row.displayName) || asString(row.name),
      providerId,
      source,
      reasoning: inferReasoning(row),
      variants: inferVariants(row),
      capabilities: sanitizeCapabilities(row),
    })
  }

  const seen = new Set<string>()
  return entries.filter((entry) => {
    if (seen.has(entry.id)) return false
    seen.add(entry.id)
    return true
  })
}

function providerHeaders(tool: ModelToolType, apiKey: string): Record<string, string> {
  if (!apiKey) return {}
  if (tool === 'claude') {
    return { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
  }
  return { authorization: `Bearer ${apiKey}` }
}

function modelUrls(provider: Pick<Provider, 'baseUrl'>): string[] {
  const baseUrl = provider.baseUrl.trim().replace(/\/+$/, '')
  if (!baseUrl) return []
  const urls = [`${baseUrl}/models`]
  if (!baseUrl.endsWith('/v1')) urls.push(`${baseUrl}/v1/models`)
  return [...new Set(urls)]
}

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json', ...headers },
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return (await response.json()) as unknown
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchProviderCatalog(
  tool: ModelToolType,
  provider: ModelCatalogRequest['provider']
): Promise<ModelCatalog | null> {
  for (const url of modelUrls(provider)) {
    try {
      const payload = await fetchJson(url, providerHeaders(tool, provider.apiKey))
      const models = normalizeEntries(payload, 'provider-api', provider.id)
      if (models.length > 0) {
        return {
          tool,
          providerId: provider.id,
          source: 'provider-api',
          fetchedAt: Date.now(),
          models,
        }
      }
    } catch {
      // Try the next compatible endpoint.
    }
  }
  return null
}

async function fetchOpenCodeCatalog(
  provider: ModelCatalogRequest['provider']
): Promise<ModelCatalog | null> {
  try {
    const payload = await fetchJson('https://models.dev/api.json')
    const providerName = provider.name.trim().toLowerCase()
    const host = (() => {
      try {
        return new URL(provider.baseUrl).hostname.toLowerCase()
      } catch {
        return ''
      }
    })()

    const matches = isRecord(payload)
      ? Object.entries(payload)
          .filter(([key, value]) => {
            const text = `${key} ${JSON.stringify(value)}`.toLowerCase()
            return text.includes(providerName) || (host && text.includes(host))
          })
          .map(([, value]) => value)
      : []
    const models = normalizeEntries(matches[0] || payload, 'models-dev', provider.id)
    if (models.length === 0) return null
    return {
      tool: 'opencode',
      providerId: provider.id,
      source: 'models-dev',
      fetchedAt: Date.now(),
      models,
    }
  } catch {
    return null
  }
}

async function fetchOpenClawCatalog(
  provider: ModelCatalogRequest['provider']
): Promise<ModelCatalog | null> {
  try {
    const { stdout } = await execFileAsync('openclaw', ['models', 'list', '--json'], {
      timeout: REQUEST_TIMEOUT_MS,
      maxBuffer: 4 * 1024 * 1024,
    })
    const payload = JSON.parse(stdout) as unknown
    const models = normalizeEntries(payload, 'openclaw-cli', provider.id)
    if (models.length === 0) return null
    return {
      tool: 'openclaw',
      providerId: provider.id,
      source: 'openclaw-cli',
      fetchedAt: Date.now(),
      models,
    }
  } catch {
    return null
  }
}

function fallbackCatalog(
  tool: ModelToolType,
  provider: ModelCatalogRequest['provider'],
  warning: string
): ModelCatalog {
  const configuredModel = resolveProviderModel(provider, '')
  const modelId = configuredModel?.trim()
  const models = modelId
    ? [
        {
          id: modelId,
          name: provider.modelConfig?.displayName,
          providerId: provider.id,
          source: 'manual' as const,
          reasoning: provider.modelConfig?.reasoning
            ? {
                mode: provider.modelConfig.reasoning.mode,
                supportedValues: provider.modelConfig.reasoning.supportedValues,
              }
            : undefined,
          variants: provider.modelConfig?.variant ? [provider.modelConfig.variant] : undefined,
          capabilities: sanitizeCapabilities(provider.modelConfig?.capabilities),
        },
      ]
    : []

  return {
    tool,
    providerId: provider.id,
    source: 'manual',
    fetchedAt: Date.now(),
    models,
    warnings: [warning],
  }
}

function readCache(): Record<string, ModelCatalog> {
  const cachePath = path.join(getAnyAIToolsDir(), CACHE_FILE)
  if (!fs.existsSync(cachePath)) return {}
  try {
    const parsed = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as unknown
    return isRecord(parsed) ? (parsed as Record<string, ModelCatalog>) : {}
  } catch {
    return {}
  }
}

function writeCache(cache: Record<string, ModelCatalog>): void {
  fs.mkdirSync(getAnyAIToolsDir(), { recursive: true })
  const cachePath = path.join(getAnyAIToolsDir(), CACHE_FILE)
  const tempPath = `${cachePath}.tmp`
  fs.writeFileSync(tempPath, JSON.stringify(cache, null, 2), { mode: 0o600 })
  fs.renameSync(tempPath, cachePath)
}

function cacheKey(request: ModelCatalogRequest): string {
  return `${request.tool}:${request.provider.id}`
}

/**
 * 拉取指定模型工具的模型目录。
 *
 * 优先级：
 * 1. 工具专用官方/本地目录（OpenCode models.dev、OpenClaw CLI）
 * 2. provider 的兼容 `/models` 接口
 * 3. 本地缓存
 * 4. 当前 provider 已保存的手动模型
 */
export async function fetchModelCatalog(request: ModelCatalogRequest): Promise<ModelCatalog> {
  const cache = readCache()
  const key = cacheKey(request)
  const cached = cache[key]

  if (!request.refresh && cached) {
    return { ...cached, source: 'cached' }
  }

  let catalog: ModelCatalog | null = null
  if (request.tool === 'opencode') {
    catalog = await fetchOpenCodeCatalog(request.provider)
  } else if (request.tool === 'openclaw') {
    catalog = await fetchOpenClawCatalog(request.provider)
  }

  catalog ||= await fetchProviderCatalog(request.tool, request.provider)
  catalog ||= cached || fallbackCatalog(request.tool, request.provider, '无法自动拉取模型目录')

  cache[key] = catalog
  writeCache(cache)
  return catalog
}

export function clearModelCatalogCache(providerId?: string): void {
  const cache = readCache()
  if (!providerId) {
    writeCache({})
    return
  }
  for (const key of Object.keys(cache)) {
    if (key.endsWith(`:${providerId}`)) delete cache[key]
  }
  writeCache(cache)
}
