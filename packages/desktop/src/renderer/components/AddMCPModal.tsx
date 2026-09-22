import { useEffect, useMemo, useState } from 'react'
import {
  X,
  Plus,
  Server,
  ExternalLink,
  AlertCircle,
  ArrowLeft,
  FileJson,
  Globe2,
  Upload,
} from 'lucide-react'
import type { MCPImportResult, MCPRegistry, MCPServer } from '@anyaitools/types'
import { MCP_PRESETS_DETAIL, type MCPPresetDetail } from '../constants/mcpPresets'
import MCPForm from './MCPForm'
import { AlertDialog } from './dialogs'

interface MCPFormData {
  name: string
  transportType: 'stdio' | 'sse' | 'streamable-http'
  command: string
  args: string
  env: string
  url: string
  headers: string
  description: string
}

interface Props {
  show: boolean
  onClose: () => void
  onSubmit: () => void
  onSuccess?: (message: string) => void
  existingServers: MCPServer[]
}

export default function AddMCPModal({
  show,
  onClose,
  onSubmit,
  onSuccess,
  existingServers,
}: Props) {
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<MCPPresetDetail | undefined>()
  const [mode, setMode] = useState<'presets' | 'json' | 'registry'>('presets')
  const [jsonText, setJsonText] = useState('')
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'overwrite' | 'rename'>(
    'rename'
  )
  const [registryUrl, setRegistryUrl] = useState('')
  const [registry, setRegistry] = useState<MCPRegistry | undefined>()
  const [registryLoading, setRegistryLoading] = useState(false)
  const [registryQuery, setRegistryQuery] = useState('')
  const [selectedRegistryKeys, setSelectedRegistryKeys] = useState<string[]>([])
  const [jsonPreview, setJsonPreview] = useState<MCPImportResult | undefined>()
  const [jsonPreviewError, setJsonPreviewError] = useState('')
  const [jsonPreviewLoading, setJsonPreviewLoading] = useState(false)

  const [alertDialog, setAlertDialog] = useState<{
    show: boolean
    title: string
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({
    show: false,
    title: '',
    message: '',
    type: 'info',
  })

  const handleSelectPreset = (preset: MCPPresetDetail) => {
    setSelectedPreset(preset)
    setShowCustomForm(true)
  }

  useEffect(() => {
    if (mode !== 'json' || !jsonText.trim()) {
      setJsonPreview(undefined)
      setJsonPreviewError('')
      setJsonPreviewLoading(false)
      return
    }

    let cancelled = false
    setJsonPreviewLoading(true)
    const timer = window.setTimeout(async () => {
      try {
        const preview = await window.electronAPI.mcp.parseJson(jsonText)
        if (!cancelled) {
          setJsonPreview(preview)
          setJsonPreviewError('')
        }
      } catch (error) {
        if (!cancelled) {
          setJsonPreview(undefined)
          setJsonPreviewError((error as Error).message)
        }
      } finally {
        if (!cancelled) setJsonPreviewLoading(false)
      }
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [jsonText, mode])

  const handleAddCustom = () => {
    setSelectedPreset(undefined)
    setShowCustomForm(true)
  }

  const handleImportJson = async () => {
    try {
      const result = await window.electronAPI.mcp.importJson(jsonText, {
        duplicateStrategy,
        source: { kind: 'json' },
      })
      onSubmit()
      onClose()
      setJsonText('')
      onSuccess?.(`已导入 ${result.added.length} 个 MCP`)
    } catch (error) {
      setAlertDialog({
        show: true,
        title: '导入 MCP JSON 失败',
        message: (error as Error).message,
        type: 'error',
      })
    }
  }

  const handleSelectJsonFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setJsonText(await file.text())
  }

  const handleLoadRegistry = async () => {
    try {
      setRegistryLoading(true)
      const loaded = await window.electronAPI.mcp.fetchRegistry(registryUrl.trim())
      setRegistry(loaded)
      setSelectedRegistryKeys(loaded.servers.map((server, index) => `${server.name}-${index}`))
    } catch (error) {
      setAlertDialog({
        show: true,
        title: '加载社区目录失败',
        message: (error as Error).message,
        type: 'error',
      })
    } finally {
      setRegistryLoading(false)
    }
  }

  const handleImportRegistry = async () => {
    if (!registry) return
    try {
      const selectedServers = registry.servers.filter((server, index) =>
        selectedRegistryKeys.includes(`${server.name}-${index}`)
      )
      if (selectedServers.length === 0) {
        throw new Error('请至少选择一个 MCP')
      }
      const result = await window.electronAPI.mcp.importJson(
        { servers: selectedServers },
        { duplicateStrategy, source: registry.source || { kind: 'registry', url: registryUrl } }
      )
      onSubmit()
      onClose()
      onSuccess?.(`已从社区目录导入 ${result.added.length} 个 MCP`)
    } catch (error) {
      setAlertDialog({
        show: true,
        title: '导入社区 MCP 失败',
        message: (error as Error).message,
        type: 'error',
      })
    }
  }

  const filteredRegistryServers = useMemo(() => {
    if (!registry) return []
    const query = registryQuery.trim().toLowerCase()
    if (!query) return registry.servers.map((server, index) => ({ server, index }))
    return registry.servers
      .map((server, index) => ({ server, index }))
      .filter(
        ({ server }) =>
          server.name.toLowerCase().includes(query) ||
          server.description?.toLowerCase().includes(query)
      )
  }, [registry, registryQuery])

  const toggleRegistrySelection = (key: string) => {
    setSelectedRegistryKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    )
  }

  const handleMCPSubmit = async (formData: MCPFormData) => {
    try {
      // 解析表单数据
      const argsArray = formData.args
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)

      let envObject: Record<string, string | number> | undefined
      if (formData.env.trim()) {
        try {
          envObject = JSON.parse(formData.env)
        } catch (error) {
          throw new Error('环境变量 JSON 格式错误')
        }
      }

      const transport =
        formData.transportType === 'stdio'
          ? {
              type: 'stdio' as const,
              command: formData.command,
              args: argsArray,
              ...(envObject ? { env: envObject } : {}),
            }
          : {
              type: formData.transportType,
              url: formData.url,
              ...(formData.headers ? { headers: JSON.parse(formData.headers) } : {}),
            }

      const input = {
        name: formData.name,
        transport,
        description: formData.description || undefined,
        // New servers are kept disabled until the user chooses host tools on
        // the server card. This avoids silently changing an unrelated tool.
        enabledTools: {},
      }

      await window.electronAPI.mcp.addCanonicalServer(input)
      onSubmit()
      onClose()
      // 重置状态
      setSelectedPreset(undefined)
      setShowCustomForm(false)
      setRegistry(undefined)
      setSelectedRegistryKeys([])
      setJsonPreview(undefined)
      onSuccess?.('添加成功')
    } catch (error) {
      setAlertDialog({
        show: true,
        title: '添加 MCP 失败',
        message: (error as Error).message,
        type: 'error',
      })
    }
  }

  const handleClose = () => {
    setSelectedPreset(undefined)
    setShowCustomForm(false)
    setMode('presets')
    setRegistry(undefined)
    setRegistryQuery('')
    setSelectedRegistryKeys([])
    setJsonText('')
    setJsonPreview(undefined)
    setJsonPreviewError('')
    onClose()
  }

  const handleBackToList = () => {
    setSelectedPreset(undefined)
    setShowCustomForm(false)
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className={`bg-white rounded-lg shadow-xl w-full ${showCustomForm ? 'max-w-2xl' : 'max-w-4xl'} max-h-[90vh] overflow-hidden flex flex-col`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-600" />
            添加 MCP 服务器
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {showCustomForm ? (
            <div>
              <button
                onClick={handleBackToList}
                className="mb-4 text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" /> 返回预设列表
              </button>
              <MCPForm
                preset={selectedPreset}
                existingServers={existingServers}
                onSubmit={handleMCPSubmit}
                onCancel={handleBackToList}
              />
            </div>
          ) : mode === 'json' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <FileJson className="w-5 h-5 text-blue-600" /> 导入 JSON 配置
                </h3>
                <button
                  onClick={() => setMode('presets')}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  返回
                </button>
              </div>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleSelectJsonFile}
                className="block w-full text-sm text-gray-600"
              />
              <textarea
                value={jsonText}
                onChange={(event) => setJsonText(event.target.value)}
                rows={14}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={
                  '{\n  "mcpServers": {\n    "filesystem": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]\n    }\n  }\n}'
                }
              />
              {jsonPreviewLoading && <p className="text-xs text-gray-500">正在检查 JSON 配置...</p>}
              {jsonPreviewError && (
                <p className="text-sm text-red-600 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  {jsonPreviewError}
                </p>
              )}
              {jsonPreview && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <div className="text-sm font-medium text-emerald-800">
                    已识别 {jsonPreview.servers.length} 个 MCP
                  </div>
                  {jsonPreview.warnings.length > 0 && (
                    <ul className="mt-1 list-disc pl-5 text-xs text-amber-700">
                      {jsonPreview.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-2 max-h-28 overflow-y-auto space-y-1">
                    {jsonPreview.servers.map((server) => (
                      <div key={server.id} className="text-xs text-emerald-900">
                        <span className="font-medium">{server.name}</span>
                        <span className="ml-2 text-emerald-700">
                          {server.transport.type === 'stdio'
                            ? `${server.transport.command} ${server.transport.args.join(' ')}`.trim()
                            : server.transport.url}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <select
                  value={duplicateStrategy}
                  onChange={(event) =>
                    setDuplicateStrategy(event.target.value as typeof duplicateStrategy)
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="rename">重名时重命名</option>
                  <option value="skip">重名时跳过</option>
                  <option value="overwrite">重名时覆盖</option>
                </select>
                <button
                  onClick={handleImportJson}
                  disabled={
                    !jsonText.trim() || !jsonPreview || !!jsonPreviewError || jsonPreviewLoading
                  }
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
                >
                  <Upload className="w-4 h-4 inline mr-1" /> 导入配置
                </button>
              </div>
            </div>
          ) : mode === 'registry' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Globe2 className="w-5 h-5 text-blue-600" /> 社区 MCP 目录
                </h3>
                <button
                  onClick={() => setMode('presets')}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  返回
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  value={registryUrl}
                  onChange={(event) => setRegistryUrl(event.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="https://example.com/mcp-registry.json"
                />
                <button
                  onClick={handleLoadRegistry}
                  disabled={registryLoading || !registryUrl.trim()}
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg disabled:opacity-50"
                >
                  {registryLoading ? '加载中...' : '加载'}
                </button>
              </div>
              <p className="text-xs text-gray-500">
                支持 HTTPS JSON、GitHub 仓库地址和 GitHub raw 文件地址。
              </p>
              {registry && (
                <>
                  <p className="text-sm text-gray-500">
                    {registry.name || registryUrl} · 已选择 {selectedRegistryKeys.length} /{' '}
                    {registry.servers.length} 个配置
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      value={registryQuery}
                      onChange={(event) => setRegistryQuery(event.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="筛选目录..."
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedRegistryKeys(
                          registry.servers.map((server, index) => `${server.name}-${index}`)
                        )
                      }
                      className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-700"
                    >
                      全选
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedRegistryKeys([])}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-700"
                    >
                      清空
                    </button>
                  </div>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {filteredRegistryServers.map(({ server, index }) => {
                      const key = `${server.name}-${index}`
                      const transport =
                        server.transport.type === 'stdio'
                          ? `${server.transport.command} ${server.transport.args.join(' ')}`.trim()
                          : server.transport.url
                      return (
                        <label
                          key={key}
                          className="flex items-start gap-3 border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-blue-300"
                        >
                          <input
                            type="checkbox"
                            checked={selectedRegistryKeys.includes(key)}
                            onChange={() => toggleRegistrySelection(key)}
                            className="mt-1 h-4 w-4 text-blue-600 rounded"
                          />
                          <span className="min-w-0">
                            <span className="block font-medium text-gray-900">{server.name}</span>
                            <span className="block text-xs text-gray-500 truncate">
                              {transport}
                            </span>
                            {server.description && (
                              <span className="block text-xs text-gray-500 mt-1">
                                {server.description}
                              </span>
                            )}
                            {server.supportedTools && (
                              <span className="block text-[11px] text-blue-600 mt-1">
                                支持: {server.supportedTools.join(', ')}
                              </span>
                            )}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={handleImportRegistry}
                      disabled={selectedRegistryKeys.length === 0}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
                    >
                      导入已选择
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-blue-600" />
                  <h3 className="text-base font-semibold text-gray-900">选择预设 MCP</h3>
                </div>
                <button
                  onClick={handleAddCustom}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  自定义添加
                </button>
              </div>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setMode('json')}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700"
                >
                  <FileJson className="w-4 h-4 inline mr-1" /> 导入 JSON
                </button>
                <button
                  onClick={() => setMode('registry')}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700"
                >
                  <Globe2 className="w-4 h-4 inline mr-1" /> 社区目录
                </button>
              </div>

              {MCP_PRESETS_DETAIL.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                  <Server className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-gray-500 mb-2">暂无可用的预设 MCP</p>
                  <p className="text-sm text-gray-400 mb-4">点击上方"自定义添加"创建配置</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {MCP_PRESETS_DETAIL.map((preset, index) => (
                    <div
                      key={`mcp-preset-${index}-${preset.name}`}
                      className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-medium text-gray-900 mb-1">
                            {preset.name}
                          </h3>
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                            官方预设
                          </span>
                        </div>
                      </div>

                      <p className="text-sm text-gray-600 mb-3">{preset.description}</p>

                      <div className="mb-3">
                        <code className="text-xs text-gray-700 bg-gray-50 px-2 py-1 rounded block overflow-x-auto whitespace-nowrap">
                          {preset.command} {preset.args.join(' ')}
                        </code>
                      </div>

                      {(preset.envRequired || preset.argsPlaceholder) && (
                        <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 flex items-start gap-1">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                          <div>
                            {preset.envRequired && (
                              <div>需要配置环境变量: {preset.envRequired.join(', ')}</div>
                            )}
                            {preset.argsPlaceholder && <div>{preset.argsPlaceholder}</div>}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2 border-t border-gray-100">
                        <button
                          onClick={() => handleSelectPreset(preset)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                          title="使用此预设"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          使用
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Alert Dialog */}
      <AlertDialog
        show={alertDialog.show}
        title={alertDialog.title}
        message={alertDialog.message}
        type={alertDialog.type}
        onClose={() => setAlertDialog({ ...alertDialog, show: false })}
      />
    </div>
  )
}
