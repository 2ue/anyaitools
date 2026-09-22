import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowDownToLine,
  BadgeInfo,
  BookOpen,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clipboard,
  DownloadCloud,
  Database,
  ExternalLink,
  FileJson2,
  Globe2,
  KeyRound,
  LayoutGrid,
  Loader2,
  Plus,
  RefreshCw,
  SearchX,
  Server,
  Search,
  ShieldCheck,
  Trash2,
  X,
  Upload,
} from 'lucide-react'
import type {
  MCPRegistryEntry,
  MCPRegistrySnapshot,
  MCPImportDuplicateStrategy,
} from '@anyaitools/types'
import { McpIcon } from './icons/BrandIcons'

interface Props {
  onImported: (message: string) => void
  onError: (message: string) => void
  onServersChanged: () => void
}

interface FlatEntry {
  entry: MCPRegistryEntry
  snapshot: MCPRegistrySnapshot
}

const MAX_VISIBLE_ENTRIES_PER_SOURCE = 12

function entryKey(item: FlatEntry): string {
  return `${item.snapshot.source.id}:${item.entry.id}`
}

function entrySource(item: FlatEntry) {
  return {
    kind:
      item.snapshot.source.kind === 'github'
        ? ('github' as const)
        : item.snapshot.source.kind === 'json'
          ? ('json' as const)
          : ('registry' as const),
    url: item.snapshot.source.url,
  }
}

function entryJson(item: FlatEntry): string {
  return JSON.stringify(
    {
      servers: [
        {
          ...item.entry.server,
          source: item.entry.server?.source || entrySource(item),
        },
      ],
    },
    null,
    2
  )
}

function transportSummary(entry: MCPRegistryEntry): string {
  if (!entry.server) return '没有可直接导入的连接配置'
  const transport = entry.server.transport
  return transport.type === 'stdio'
    ? [transport.command, ...transport.args].filter(Boolean).join(' ')
    : transport.url
}

export default function MCPRegistryPanel({ onImported, onError, onServersChanged }: Props) {
  const [snapshots, setSnapshots] = useState<MCPRegistrySnapshot[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshingAll, setRefreshingAll] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [duplicateStrategy, setDuplicateStrategy] = useState<MCPImportDuplicateStrategy>('rename')
  const [expanded, setExpanded] = useState(true)
  const [catalogFilter, setCatalogFilter] = useState<'all' | 'installable'>('all')
  const [showSourceForm, setShowSourceForm] = useState(false)
  const [sourceName, setSourceName] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceKind, setSourceKind] = useState<'json' | 'github' | 'official-api'>('json')
  const [refreshingSourceId, setRefreshingSourceId] = useState<string | null>(null)
  const [expandedSourceIds, setExpandedSourceIds] = useState<string[]>([])
  const [detailItem, setDetailItem] = useState<FlatEntry | undefined>()
  const [copyingJson, setCopyingJson] = useState(false)
  const [importingEntry, setImportingEntry] = useState(false)

  const loadCatalog = async () => {
    try {
      setLoading(true)
      const cached = await window.electronAPI.mcp.searchRegistry()
      setSnapshots(cached)
      setSelected([])
      setLoading(false)

      const sources = await window.electronAPI.mcp.listRegistrySources()
      setRefreshingAll(true)
      await Promise.allSettled(
        sources
          .filter((source) => source.enabled)
          .map(async (source) => {
            try {
              const refreshed = await window.electronAPI.mcp.refreshRegistrySource(source.id)
              setSnapshots((current) => {
                const next = current.filter((snapshot) => snapshot.source.id !== source.id)
                const sourceIndex = current.findIndex(
                  (snapshot) => snapshot.source.id === source.id
                )
                next.splice(sourceIndex < 0 ? next.length : sourceIndex, 0, refreshed)
                return next
              })
            } catch {
              // refreshRegistrySource returns cached snapshots with an error when possible.
              // A failing source should not prevent the other directories from rendering.
            }
          })
      )
    } catch (error) {
      onError((error as Error).message)
    } finally {
      setLoading(false)
      setRefreshingAll(false)
    }
  }

  useEffect(() => {
    void loadCatalog()
  }, [])

  const entries = useMemo<FlatEntry[]>(() => {
    const needle = query.trim().toLowerCase()
    return snapshots.flatMap((snapshot) =>
      snapshot.entries
        .filter((entry) => {
          if (!needle) return true
          return [entry.name, entry.description, entry.repository, entry.documentationUrl]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(needle))
        })
        .map((entry) => ({ entry, snapshot }))
    )
  }, [query, snapshots])

  const selectableEntries = entries.filter(({ entry }) => entry.installable && entry.server)
  const selectedEntries = selectableEntries.filter((item) => selected.includes(entryKey(item)))
  const installableCount = entries.filter(({ entry }) => entry.installable).length
  const visibleEntryCount = catalogFilter === 'all' ? entries.length : installableCount
  const sourceCount = snapshots.length

  const getEntryDescription = (entry: MCPRegistryEntry): string => {
    if (entry.description?.trim()) return entry.description.trim()
    if (entry.category)
      return `用于「${entry.category}」场景的 MCP 连接器。打开详情查看连接方式和配置要求。`
    if (entry.transportType)
      return `通过 ${entry.transportType.toUpperCase()} 连接外部能力。打开详情查看它需要的环境变量和导入配置。`
    return '目录只提供了名称和来源信息。打开详情查看仓库、文档和原始配置。'
  }

  const toggleEntry = (item: FlatEntry) => {
    if (!item.entry.installable || !item.entry.server) return
    const key = entryKey(item)
    setSelected((current) =>
      current.includes(key) ? current.filter((value) => value !== key) : [...current, key]
    )
  }

  const importSelected = async () => {
    if (selectedEntries.length === 0) return
    try {
      const result = await window.electronAPI.mcp.importJson(
        {
          servers: selectedEntries.map(({ entry, snapshot }) => ({
            ...entry.server!,
            source: entry.server?.source || entrySource({ entry, snapshot }),
          })),
        },
        {
          duplicateStrategy,
        }
      )
      setSelected([])
      onServersChanged()
      onImported(`已从目录导入 ${result.added.length} 个 MCP`)
    } catch (error) {
      onError((error as Error).message)
    }
  }

  const importEntry = async (item: FlatEntry) => {
    if (!item.entry.server) return
    try {
      setImportingEntry(true)
      const result = await window.electronAPI.mcp.importJson(
        {
          servers: [
            { ...item.entry.server, source: item.entry.server.source || entrySource(item) },
          ],
        },
        { duplicateStrategy }
      )
      setDetailItem(undefined)
      onServersChanged()
      onImported(`已导入 ${result.added.length} 个 MCP，默认未启用任何工具`)
    } catch (error) {
      onError((error as Error).message)
    } finally {
      setImportingEntry(false)
    }
  }

  const copyEntryJson = async (item: FlatEntry) => {
    try {
      setCopyingJson(true)
      await navigator.clipboard.writeText(entryJson(item))
      onImported('MCP JSON 已复制到剪贴板')
    } catch (error) {
      onError(`复制 JSON 失败：${(error as Error).message}`)
    } finally {
      setCopyingJson(false)
    }
  }

  const openExternal = async (url: string) => {
    try {
      await window.electronAPI.system.openUrl(url)
    } catch (error) {
      onError(`打开链接失败：${(error as Error).message}`)
    }
  }

  const addSource = async () => {
    if (!sourceUrl.trim()) return
    try {
      await window.electronAPI.mcp.addRegistrySource({
        name: sourceName.trim() || sourceUrl.trim(),
        url: sourceUrl.trim(),
        kind: sourceKind,
      })
      setSourceName('')
      setSourceUrl('')
      setShowSourceForm(false)
      await loadCatalog()
    } catch (error) {
      onError((error as Error).message)
    }
  }

  const removeSource = async (sourceId: string) => {
    try {
      await window.electronAPI.mcp.removeRegistrySource(sourceId)
      await loadCatalog()
    } catch (error) {
      onError((error as Error).message)
    }
  }

  const refreshSource = async (sourceId: string) => {
    try {
      setRefreshingSourceId(sourceId)
      const refreshed = await window.electronAPI.mcp.refreshRegistrySource(sourceId)
      setSnapshots((current) => [
        ...current.filter((snapshot) => snapshot.source.id !== sourceId),
        refreshed,
      ])
      setSelected((current) => current.filter((key) => !key.startsWith(`${sourceId}:`)))
    } catch (error) {
      onError((error as Error).message)
    } finally {
      setRefreshingSourceId(null)
    }
  }

  return (
    <section className="mx-4 mt-5 mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:mx-6">
      <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-6 md:px-7">
        <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-start">
          <div className="flex min-w-0 gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Globe2 className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
                  MCP DIRECTORY
                </span>
                {refreshingAll && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    后台更新中
                  </span>
                )}
              </div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 md:text-2xl">
                先了解用途，再把 MCP 接入你的工具
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                MCP（Model Context Protocol）是 AI
                工具连接外部能力的标准方式。这里的条目是来自官方和社区的服务说明与配置模板，不会自动安装依赖，也不会自动启用任何工具。
              </p>
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-3 gap-2 sm:gap-3">
            <div className="min-w-[78px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center">
              <div className="text-lg font-semibold text-slate-950">{sourceCount}</div>
              <div className="text-[11px] text-slate-500">目录来源</div>
            </div>
            <div className="min-w-[78px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center">
              <div className="text-lg font-semibold text-slate-950">{visibleEntryCount}</div>
              <div className="text-[11px] text-slate-500">当前条目</div>
            </div>
            <div className="min-w-[78px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center">
              <div className="text-lg font-semibold text-emerald-700">{installableCount}</div>
              <div className="text-[11px] text-slate-500">可直接导入</div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="flex gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <div>
              <div className="text-sm font-semibold text-slate-900">1. 先看用途</div>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                每个条目都会说明它连接什么服务、使用哪种传输方式，以及是否需要密钥。
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <DownloadCloud className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <div>
              <div className="text-sm font-semibold text-slate-900">2. 再看配置</div>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                打开详情可以查看原始 JSON，复制给其他工具，或直接导入到本软件。
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <div>
              <div className="text-sm font-semibold text-slate-900">3. 最后按工具启用</div>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                导入只保存配置，默认不启用。你可以在下方 MCP 卡片中单独开关 Claude、Codex、Gemini 或
                Grok。
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3 md:px-7">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900"
        >
          <LayoutGrid className="h-4 w-4 text-blue-600" />
          浏览目录
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </button>
        <div className="flex items-center gap-2">
          {selectedEntries.length > 0 && (
            <>
              <select
                value={duplicateStrategy}
                onChange={(event) =>
                  setDuplicateStrategy(event.target.value as MCPImportDuplicateStrategy)
                }
                className="hidden rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 sm:block"
                aria-label="目录重复名策略"
              >
                <option value="rename">重名重命名</option>
                <option value="skip">重名跳过</option>
                <option value="overwrite">重名覆盖</option>
              </select>
              <button
                type="button"
                onClick={() => void importSelected()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                <Upload className="h-3.5 w-3.5" />
                导入 {selectedEntries.length} 个
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setShowSourceForm((value) => !value)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:border-blue-300 hover:text-blue-700"
            title="添加目录来源"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">添加来源</span>
          </button>
          <button
            type="button"
            onClick={() => void loadCatalog()}
            disabled={loading || refreshingAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50"
            title="刷新内置目录"
          >
            {loading || refreshingAll ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">刷新</span>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-5 px-5 py-5 md:px-7">
          {showSourceForm && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
              <div className="mb-3 flex items-start gap-3">
                <Plus className="mt-0.5 h-4 w-4 text-blue-700" />
                <div>
                  <div className="text-sm font-semibold text-slate-900">添加一个目录来源</div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    支持返回 JSON 的目录、GitHub README 或官方 Registry
                    API。只读取目录元数据，不会执行远程内容。
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1.4fr_auto_auto]">
                <input
                  value={sourceName}
                  onChange={(event) => setSourceName(event.target.value)}
                  placeholder="来源名称（可选）"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <input
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  placeholder="https://example.com/mcp-registry.json"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                />
                <select
                  value={sourceKind}
                  onChange={(event) =>
                    setSourceKind(event.target.value as 'json' | 'github' | 'official-api')
                  }
                  className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                  aria-label="目录来源类型"
                >
                  <option value="json">JSON 目录</option>
                  <option value="github">GitHub README</option>
                  <option value="official-api">官方 Registry API</option>
                </select>
                <button
                  type="button"
                  onClick={() => void addSource()}
                  disabled={!sourceUrl.trim()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  保存并加载
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索名称、用途、仓库或文档..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setCatalogFilter('all')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                    catalogFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  全部 {entries.length}
                </button>
                <button
                  type="button"
                  onClick={() => setCatalogFilter('installable')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                    catalogFilter === 'installable'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  可直接导入 {installableCount}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSelected(selectableEntries.map(entryKey))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:border-blue-300 hover:text-blue-700"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                全选可导入
              </button>
              <button
                type="button"
                onClick={() => setSelected([])}
                disabled={selected.length === 0}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:border-slate-300 disabled:opacity-50"
              >
                清空选择
              </button>
            </div>
          </div>

          {snapshots.length === 0 && (loading || refreshingAll) && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-5 py-10 text-center">
              <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-600" />
              <div className="text-sm font-medium text-slate-800">
                正在加载目录，已配置的 MCP 不受影响
              </div>
              <p className="mt-1 text-xs text-slate-500">
                目录来自多个来源，页面会先显示缓存，再逐个更新。
              </p>
            </div>
          )}

          {snapshots.map((snapshot) => {
            const sourceEntries = entries
              .filter(({ snapshot: current }) => current.source.id === snapshot.source.id)
              .filter(({ entry }) => catalogFilter === 'all' || entry.installable)
            const isSourceExpanded = expandedSourceIds.includes(snapshot.source.id)
            const visibleEntries = isSourceExpanded
              ? sourceEntries
              : sourceEntries.slice(0, MAX_VISIBLE_ENTRIES_PER_SOURCE)
            return (
              <section
                key={snapshot.source.id}
                className="overflow-hidden rounded-xl border border-slate-200"
              >
                <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm ring-1 ring-slate-200">
                      {snapshot.source.kind === 'github' ? (
                        <BookOpen className="h-4 w-4" />
                      ) : snapshot.source.kind === 'official-api' ? (
                        <Server className="h-4 w-4" />
                      ) : (
                        <Database className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">
                          {snapshot.source.name}
                        </h3>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
                          {snapshot.entries.length} 个条目
                        </span>
                        {snapshot.stale && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                            使用缓存
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                        {snapshot.source.description || snapshot.source.url}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {snapshot.error && (
                      <span
                        className="inline-flex items-center gap-1 text-xs text-amber-700"
                        title={snapshot.error}
                      >
                        <AlertCircle className="h-3.5 w-3.5" />
                        更新失败，保留缓存
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => void refreshSource(snapshot.source.id)}
                      disabled={refreshingSourceId === snapshot.source.id}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-blue-700 disabled:opacity-50"
                      title="刷新此目录来源"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${
                          refreshingSourceId === snapshot.source.id ? 'animate-spin' : ''
                        }`}
                      />
                      刷新
                    </button>
                    {!snapshot.source.builtIn && (
                      <button
                        type="button"
                        onClick={() => void removeSource(snapshot.source.id)}
                        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-600"
                        title="删除自定义来源"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        删除
                      </button>
                    )}
                  </div>
                </div>

                {sourceEntries.length === 0 ? (
                  <div className="flex items-center gap-3 px-4 py-8 text-sm text-slate-500">
                    <SearchX className="h-5 w-5 text-slate-400" />
                    {snapshot.error || (query ? '这个来源没有匹配的条目' : '没有可展示的目录条目')}
                  </div>
                ) : (
                  <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
                    {visibleEntries.map((item) => {
                      const { entry } = item
                      const key = entryKey(item)
                      const isSelected = selected.includes(key)
                      return (
                        <article
                          key={key}
                          className={`flex min-h-[228px] flex-col rounded-xl border p-4 transition ${
                            isSelected
                              ? 'border-blue-400 bg-blue-50/40 shadow-sm'
                              : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-blue-700">
                              <McpIcon size={21} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => setDetailItem(item)}
                                  className="min-w-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                  title="查看 MCP 详情"
                                >
                                  <h4 className="line-clamp-2 text-sm font-semibold text-slate-900 hover:text-blue-700">
                                    {entry.name}
                                  </h4>
                                </button>
                                {entry.installable ? (
                                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700">
                                    <CheckCircle2 className="h-3 w-3" />
                                    可导入
                                  </span>
                                ) : (
                                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500">
                                    仅信息
                                  </span>
                                )}
                              </div>
                              <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">
                                {getEntryDescription(entry)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-1.5">
                            {entry.category && (
                              <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] text-slate-600">
                                {entry.category}
                              </span>
                            )}
                            {entry.transportType && (
                              <span className="rounded-md border border-slate-200 px-2 py-1 text-[10px] uppercase text-slate-500">
                                {entry.transportType}
                              </span>
                            )}
                            {entry.authType && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[10px] text-slate-500">
                                <KeyRound className="h-3 w-3" />
                                {entry.authType}
                              </span>
                            )}
                            {entry.toolCount !== undefined && (
                              <span className="rounded-md border border-slate-200 px-2 py-1 text-[10px] text-slate-500">
                                {entry.toolCount} 个工具
                              </span>
                            )}
                          </div>

                          <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                            <label
                              className={`inline-flex items-center gap-2 text-xs ${
                                entry.installable
                                  ? 'cursor-pointer text-slate-600'
                                  : 'cursor-not-allowed text-slate-400'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={!entry.installable}
                                onChange={() => toggleEntry(item)}
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                              />
                              选择导入
                            </label>
                            <button
                              type="button"
                              onClick={() => setDetailItem(item)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800"
                            >
                              查看详情
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          {entry.warnings.length > 0 && (
                            <div className="mt-2 flex items-start gap-1 text-[10px] leading-4 text-amber-700">
                              <BadgeInfo className="mt-0.5 h-3 w-3 shrink-0" />
                              <span className="line-clamp-2">{entry.warnings.join('；')}</span>
                            </div>
                          )}
                        </article>
                      )
                    })}
                  </div>
                )}

                {sourceEntries.length > visibleEntries.length && (
                  <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-3">
                    <span className="text-xs text-slate-500">
                      当前显示 {visibleEntries.length} 个，共 {sourceEntries.length} 个匹配结果。
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedSourceIds((current) =>
                          current.includes(snapshot.source.id)
                            ? current.filter((id) => id !== snapshot.source.id)
                            : [...current, snapshot.source.id]
                        )
                      }
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800"
                    >
                      {isSourceExpanded ? '收起' : '显示全部'}
                      {isSourceExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      {detailItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${detailItem.entry.name} MCP 详情`}
          onClick={() => setDetailItem(undefined)}
        >
          <div
            className="w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-100 bg-white px-5 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-900">{detailItem.entry.name}</h2>
                  {detailItem.entry.transportType && (
                    <span className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] uppercase text-gray-500">
                      {detailItem.entry.transportType}
                    </span>
                  )}
                  {detailItem.entry.installable ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      可直接导入
                    </span>
                  ) : (
                    <span className="text-xs text-amber-700">仅目录信息</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  来自：{detailItem.snapshot.source.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailItem(undefined)}
                className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                title="关闭详情"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 px-5 py-5">
              <section className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-4">
                <div className="flex items-start gap-3">
                  <BadgeInfo className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-blue-900">
                      这是做什么的
                    </h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {getEntryDescription(detailItem.entry)}
                    </p>
                  </div>
                </div>
              </section>

              <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    连接方式
                  </h3>
                  <code className="block max-h-28 overflow-auto whitespace-pre-wrap break-all rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                    {transportSummary(detailItem.entry)}
                  </code>
                </div>
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    使用前需要知道
                  </h3>
                  <div className="space-y-1 text-sm text-gray-700">
                    {detailItem.entry.envRequirements?.length ? (
                      <p>环境变量：{detailItem.entry.envRequirements.join('、')}</p>
                    ) : (
                      <p>目录没有声明必填环境变量。</p>
                    )}
                    <p>导入后不会自动启用 Claude、Codex、Gemini 或 Grok。</p>
                  </div>
                </div>
              </section>

              {(detailItem.entry.repository || detailItem.entry.documentationUrl) && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    来源与文档
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {detailItem.entry.repository && (
                      <button
                        type="button"
                        onClick={() => void openExternal(detailItem.entry.repository!)}
                        className="inline-flex items-center gap-1.5 rounded border border-gray-200 px-3 py-2 text-xs text-gray-700 hover:border-blue-300 hover:text-blue-600"
                      >
                        仓库 <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {detailItem.entry.documentationUrl && (
                      <button
                        type="button"
                        onClick={() => void openExternal(detailItem.entry.documentationUrl!)}
                        className="inline-flex items-center gap-1.5 rounded border border-gray-200 px-3 py-2 text-xs text-gray-700 hover:border-blue-300 hover:text-blue-600"
                      >
                        文档 <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </section>
              )}

              {detailItem.entry.warnings.length > 0 && (
                <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  {detailItem.entry.warnings.join('；')}
                </div>
              )}

              <section>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    可导入 JSON
                  </h3>
                  <button
                    type="button"
                    onClick={() => void copyEntryJson(detailItem)}
                    disabled={copyingJson}
                    className="inline-flex items-center gap-1.5 rounded border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 hover:border-blue-300 disabled:opacity-50"
                  >
                    <Clipboard className="h-3.5 w-3.5" />
                    {copyingJson ? '复制中...' : '复制 JSON'}
                  </button>
                </div>
                <pre className="max-h-56 overflow-auto rounded border border-gray-200 bg-gray-950 p-3 text-xs leading-5 text-gray-100">
                  {entryJson(detailItem)}
                </pre>
              </section>
            </div>

            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-white px-5 py-4">
              <span className="text-xs text-gray-500">导入后请在 MCP 卡片上选择要启用的工具。</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void copyEntryJson(detailItem)}
                  className="inline-flex items-center gap-1.5 rounded border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:border-blue-300"
                >
                  <FileJson2 className="h-3.5 w-3.5" />
                  复制配置
                </button>
                <button
                  type="button"
                  onClick={() => void importEntry(detailItem)}
                  disabled={!detailItem.entry.installable || importingEntry}
                  className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowDownToLine className="h-3.5 w-3.5" />
                  {importingEntry ? '导入中...' : '一键导入'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
