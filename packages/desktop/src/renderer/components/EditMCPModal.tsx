import { useState } from 'react'
import { X, Server } from 'lucide-react'
import type { MCPServer } from '@anyaitools/types'
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
  server: MCPServer
  onClose: () => void
  onSubmit: () => void
  onSuccess?: (message: string) => void
  existingServers: MCPServer[]
}

export default function EditMCPModal({
  show,
  server,
  onClose,
  onSubmit,
  onSuccess,
  existingServers,
}: Props) {
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

      const updates = {
        name: formData.name,
        transport,
        description: formData.description || undefined,
      }

      await window.electronAPI.mcp.editCanonicalServer(server.id, updates)
      onSubmit()
      onClose()
      onSuccess?.('编辑成功')
    } catch (error) {
      setAlertDialog({
        show: true,
        title: '编辑 MCP 失败',
        message: (error as Error).message,
        type: 'error',
      })
    }
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="flex max-h-[90vh] min-h-0 w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-600" />
            编辑 MCP 服务器
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <MCPForm
            server={server}
            existingServers={existingServers}
            onSubmit={handleMCPSubmit}
            onCancel={onClose}
          />
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
