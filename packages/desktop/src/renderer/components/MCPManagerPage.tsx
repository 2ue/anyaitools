import { useState, useEffect } from 'react'
import type { MCPServer, MCPToolCapability, MCPToolType } from '@anyaitools/types'
import MCPCard from './MCPCard'
import ConfigEditorModal from './ConfigEditorModal'
import AddMCPModal from './AddMCPModal'
import EditMCPModal from './EditMCPModal'
import CloneMCPModal from './CloneMCPModal'
import MCPRegistryPanel from './MCPRegistryPanel'
import { AlertDialog, ConfirmDialog } from './dialogs'
import { Plus, Inbox, Search, FileCode2, Download, SlidersHorizontal } from 'lucide-react'
import { McpIcon } from './icons/BrandIcons'
import { BUTTON_WITH_ICON, BUTTON_STYLES } from '../styles/button'

export default function MCPManagerPage() {
  const [servers, setServers] = useState<MCPServer[]>([])
  const [capabilities, setCapabilities] = useState<MCPToolCapability[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [showConfigEditor, setShowConfigEditor] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCloneModal, setShowCloneModal] = useState(false)
  const [selectedServer, setSelectedServer] = useState<MCPServer | undefined>()
  const [configFiles, setConfigFiles] = useState<
    Array<{ name: string; path: string; content: string; language: 'json' | 'toml' | 'env' }>
  >([])

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

  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
  })

  // 加载 MCP 列表
  useEffect(() => {
    Promise.all([loadServers(), loadCapabilities()])
  }, [])

  const loadCapabilities = async () => {
    try {
      setCapabilities(await window.electronAPI.mcp.listCapabilities())
    } catch (error) {
      setAlertDialog({
        show: true,
        title: '加载工具能力失败',
        message: (error as Error).message,
        type: 'error',
      })
    }
  }

  const loadServers = async () => {
    try {
      setLoading(true)
      const data = await window.electronAPI.mcp.listServers()
      // 防御性处理: 确保始终为数组,即使后端返回了异常结构也不至于打崩页面
      if (Array.isArray(data)) {
        setServers(data)
      } else {
        console.error('Invalid MCP servers data:', data)
        setServers([])
        setAlertDialog({
          show: true,
          title: '加载失败',
          message: 'MCP 配置格式异常，请检查 ~/.anyaitools/mcp.json 或通过 CLI 重新生成。',
          type: 'error',
        })
      }
    } catch (error) {
      setAlertDialog({
        show: true,
        title: '加载失败',
        message: (error as Error).message,
        type: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  // 切换应用启用状态
  const handleToggleTool = async (serverId: string, tool: MCPToolType, enabled: boolean) => {
    try {
      await window.electronAPI.mcp.toggleApp(serverId, tool, enabled)

      // 更新本地状态
      setServers((prev) =>
        prev.map((s) =>
          s.id === serverId
            ? {
                ...s,
                enabledTools: { ...s.enabledTools, [tool]: enabled },
                enabledApps: enabled
                  ? [...new Set([...(s.enabledApps || []), tool])]
                  : (s.enabledApps || []).filter((a) => a !== tool),
              }
            : s
        )
      )

      setAlertDialog({
        show: true,
        title: '操作成功',
        message: `已${enabled ? '启用' : '禁用'} MCP 在该应用上`,
        type: 'success',
      })
    } catch (error) {
      setAlertDialog({
        show: true,
        title: '操作失败',
        message: (error as Error).message,
        type: 'error',
      })
    }
  }

  // 编辑 MCP
  const handleEdit = (server: MCPServer) => {
    setSelectedServer(server)
    setShowEditModal(true)
  }

  // 克隆 MCP
  const handleClone = (server: MCPServer) => {
    setSelectedServer(server)
    setShowCloneModal(true)
  }

  // 删除 MCP
  const handleDelete = (server: MCPServer) => {
    setConfirmDialog({
      show: true,
      title: '确认删除',
      message: `确定要删除 MCP 服务器 "${server.name}" 吗？这将从所有应用中移除此 MCP 配置。`,
      onConfirm: async () => {
        try {
          await window.electronAPI.mcp.removeServer(server.id)
          setServers((prev) => prev.filter((s) => s.id !== server.id))
          setAlertDialog({
            show: true,
            title: '删除成功',
            message: `已删除 MCP: ${server.name}`,
            type: 'success',
          })
        } catch (error) {
          setAlertDialog({
            show: true,
            title: '删除失败',
            message: (error as Error).message,
            type: 'error',
          })
        }
      },
    })
  }

  // 添加 MCP
  const handleAdd = () => {
    setShowAddModal(true)
  }

  const handleExportJson = async () => {
    try {
      const content = await window.electronAPI.mcp.exportJson()
      const blob = new Blob([content], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'mcp-servers.json'
      anchor.click()
      URL.revokeObjectURL(url)
      setAlertDialog({
        show: true,
        title: '导出成功',
        message: 'MCP JSON 配置已下载',
        type: 'success',
      })
    } catch (error) {
      setAlertDialog({
        show: true,
        title: '导出失败',
        message: (error as Error).message,
        type: 'error',
      })
    }
  }

  // 编辑配置文件
  const handleEditConfig = async () => {
    try {
      const files = await window.electronAPI.config.readConfigFiles('mcp')
      setConfigFiles(files)
      setShowConfigEditor(true)
    } catch (error) {
      setAlertDialog({
        show: true,
        title: '读取配置文件失败',
        message: (error as Error).message,
        type: 'error',
      })
    }
  }

  // 保存配置文件
  const handleSaveConfig = async (
    files: Array<{ name: string; path: string; content: string; language: 'json' | 'toml' | 'env' }>
  ) => {
    try {
      await window.electronAPI.config.writeConfigFiles(files)
      // 重新加载服务器列表
      await loadServers()
      setAlertDialog({
        show: true,
        title: '保存成功',
        message: 'MCP 配置文件已更新',
        type: 'success',
      })
    } catch (error) {
      setAlertDialog({
        show: true,
        title: '保存失败',
        message: (error as Error).message,
        type: 'error',
      })
    }
  }

  // 搜索过滤
  const filteredServers = servers.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.transport.type === 'stdio'
        ? `${s.transport.command} ${s.transport.args.join(' ')}`
        : s.transport.url
      )
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="border-b border-gray-200 bg-white px-6 py-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <McpIcon size={25} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">MCP 服务器管理</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
                从目录了解 MCP 的用途和配置，再导入到本地。导入后可以为每个服务器单独选择要启用的 AI
                工具。
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                <span className="rounded-full bg-gray-100 px-2.5 py-1">
                  已导入 {servers.length} 个
                </span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1">默认不自动启用</span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1">支持 JSON 配置</span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button onClick={handleEditConfig} className={BUTTON_STYLES.icon} title="编辑配置文件">
              <FileCode2 className="w-5 h-5" />
            </button>
            <button onClick={handleExportJson} className={BUTTON_STYLES.icon} title="导出 JSON">
              <Download className="w-5 h-5" />
            </button>
            <button onClick={handleAdd} className={BUTTON_WITH_ICON.primary}>
              <Plus className="w-4 h-4" />
              添加 MCP
            </button>
          </div>
        </div>
      </div>

      <MCPRegistryPanel
        onServersChanged={() => void loadServers()}
        onImported={(message) =>
          setAlertDialog({
            show: true,
            title: '目录导入成功',
            message,
            type: 'success',
          })
        }
        onError={(message) =>
          setAlertDialog({
            show: true,
            title: 'MCP 目录操作失败',
            message,
            type: 'error',
          })
        }
      />

      <section className="mx-4 mb-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:mx-6">
        <div className="border-b border-gray-200 bg-gray-50/80 px-5 py-4 md:px-6">
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
            <div className="flex items-start gap-3">
              <SlidersHorizontal className="mt-0.5 h-5 w-5 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">已导入的 MCP</h2>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  在这里管理连接配置，并为每个 MCP 单独开启或关闭 Claude、Codex、Gemini、Grok
                  等工具。
                </p>
              </div>
            </div>
            <div className="relative w-full lg:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索已导入的 MCP..."
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          {searchQuery && (
            <p className="mt-3 text-xs text-gray-500">
              当前显示 {filteredServers.length} 个结果，共 {servers.length} 个已导入 MCP
            </p>
          )}
        </div>
        <div className="p-5 md:p-6">
          {servers.length === 0 ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-5 text-center text-gray-500">
              <Inbox className="mb-4 h-12 w-12 text-gray-300" />
              <p className="mb-2 text-base font-semibold text-gray-800">还没有已导入的 MCP</p>
              <p className="max-w-md text-sm leading-6 text-gray-500">
                目录里的条目只是可查看的服务说明和配置模板。确认用途后，点击详情中的“一键导入”，再回来为工具开关。
              </p>
              <button onClick={handleAdd} className={`${BUTTON_WITH_ICON.primary} mt-5`}>
                <Plus className="w-4 h-4" />
                手动添加 MCP
              </button>
            </div>
          ) : filteredServers.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center text-gray-500">
              <Inbox className="mb-4 h-12 w-12 text-gray-300" />
              <p className="mb-2 text-base font-semibold text-gray-800">没有匹配的 MCP</p>
              <p className="text-sm text-gray-500">尝试使用其他名称、连接地址或描述搜索</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredServers.map((server) => (
                <MCPCard
                  key={server.id}
                  server={server}
                  capabilities={capabilities}
                  onToggleTool={(tool, enabled) => handleToggleTool(server.id, tool, enabled)}
                  onEdit={() => handleEdit(server)}
                  onClone={() => handleClone(server)}
                  onDelete={() => handleDelete(server)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Dialogs */}
      <AlertDialog
        show={alertDialog.show}
        title={alertDialog.title}
        message={alertDialog.message}
        type={alertDialog.type}
        onClose={() => setAlertDialog({ ...alertDialog, show: false })}
      />

      <ConfirmDialog
        show={confirmDialog.show}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={() => {
          confirmDialog.onConfirm()
          setConfirmDialog({ ...confirmDialog, show: false })
        }}
        onCancel={() => setConfirmDialog({ ...confirmDialog, show: false })}
      />

      {/* Config Editor Modal */}
      <ConfigEditorModal
        show={showConfigEditor}
        title="编辑 MCP 配置文件"
        files={configFiles}
        onSave={handleSaveConfig}
        onClose={() => setShowConfigEditor(false)}
      />

      {/* Add MCP Modal */}
      <AddMCPModal
        show={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={() => loadServers()}
        onSuccess={(message) => {
          setAlertDialog({
            show: true,
            title: '添加成功',
            message,
            type: 'success',
          })
        }}
        existingServers={servers}
      />

      {/* Edit MCP Modal */}
      {selectedServer && (
        <EditMCPModal
          show={showEditModal}
          server={selectedServer}
          onClose={() => {
            setShowEditModal(false)
            setSelectedServer(undefined)
          }}
          onSubmit={() => loadServers()}
          onSuccess={(message) => {
            setAlertDialog({
              show: true,
              title: '编辑成功',
              message,
              type: 'success',
            })
          }}
          existingServers={servers}
        />
      )}

      {/* Clone MCP Modal */}
      {selectedServer && (
        <CloneMCPModal
          show={showCloneModal}
          server={selectedServer}
          onClose={() => {
            setShowCloneModal(false)
            setSelectedServer(undefined)
          }}
          onSuccess={(message) => {
            loadServers()
            setAlertDialog({
              show: true,
              title: '克隆成功',
              message,
              type: 'success',
            })
          }}
          existingServers={servers}
        />
      )}
    </div>
  )
}
