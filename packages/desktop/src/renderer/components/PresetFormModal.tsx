import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { TOOL_TYPES, TOOL_CONFIG, type ToolType, type ApiBackend } from '@anyaitools/types'
import { AlertDialog } from './dialogs'

interface PresetData {
  name: string
  baseUrl: string
  description: string
  model?: string
  apiBackend?: ApiBackend
  supportsBackendSearch?: boolean
}

const API_BACKEND_OPTIONS: Array<{ value: ApiBackend; label: string }> = [
  { value: 'chat_completions', label: 'Chat Completions' },
  { value: 'responses', label: 'Responses' },
  { value: 'messages', label: 'Messages' },
]

interface Props {
  show: boolean
  preset?: PresetData
  type: Exclude<ToolType, 'mcp'>
  onClose: () => void
  onSubmit: () => void
  onSuccess?: (message: string) => void
}

export default function PresetFormModal({
  show,
  preset,
  type,
  onClose,
  onSubmit,
  onSuccess,
}: Props) {
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [description, setDescription] = useState('')
  const [model, setModel] = useState('')
  const [apiBackend, setApiBackend] = useState<ApiBackend>('chat_completions')
  const [supportsBackendSearch, setSupportsBackendSearch] = useState(false)
  const [useBuiltinModel, setUseBuiltinModel] = useState(false)

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

  useEffect(() => {
    if (preset) {
      setName(preset.name)
      setBaseUrl(preset.baseUrl)
      setDescription(preset.description)
      setModel(preset.model || '')
      setApiBackend(preset.apiBackend || 'chat_completions')
      setSupportsBackendSearch(preset.supportsBackendSearch ?? false)
      setUseBuiltinModel(type === TOOL_TYPES.GROK && !preset.baseUrl.trim())
    } else {
      setName('')
      setBaseUrl('')
      setDescription('')
      setModel('')
      setApiBackend('chat_completions')
      setSupportsBackendSearch(false)
      setUseBuiltinModel(false)
    }
  }, [preset, show, type])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const api = (() => {
        switch (type) {
          case TOOL_TYPES.CODEX:
            return window.electronAPI.codex
          case TOOL_TYPES.CLAUDE:
            return window.electronAPI.claude
          case TOOL_TYPES.GEMINI:
            return window.electronAPI.gemini
          case TOOL_TYPES.OPENCODE:
            return window.electronAPI.opencode
          case TOOL_TYPES.OPENCLAW:
            return window.electronAPI.openclaw
          case TOOL_TYPES.GROK:
            return window.electronAPI.grok
        }
      })()

      const input = {
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        description: description.trim(),
        ...(type === TOOL_TYPES.GROK
          ? {
              model: model.trim(),
              ...(useBuiltinModel ? {} : { apiBackend, supportsBackendSearch }),
            }
          : {}),
      }

      if (preset) {
        // 编辑模式
        await api.editPreset(preset.name, input)
        onSuccess?.('更新成功')
      } else {
        // 添加模式
        await api.addPreset(input)
        onSuccess?.('添加成功')
      }

      onSubmit()
      onClose()
    } catch (error) {
      setAlertDialog({
        show: true,
        title: '操作失败',
        message: (error as Error).message,
        type: 'error',
      })
    }
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="flex max-h-[90vh] min-h-0 w-full max-w-md flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {preset ? '编辑预置服务商' : '添加预置服务商'} - {TOOL_CONFIG[type].displayName}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">服务商名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="我的自定义 API"
              required
            />
          </div>

          {type === TOOL_TYPES.GROK && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">模型来源</label>
                <div
                  className="grid grid-cols-2 rounded-lg border border-gray-200 bg-gray-50 p-1"
                  role="radiogroup"
                  aria-label="模型来源"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={useBuiltinModel}
                    onClick={() => {
                      setUseBuiltinModel(true)
                      setBaseUrl('')
                      if (!model.trim()) setModel('grok-build')
                    }}
                    className={`min-h-9 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      useBuiltinModel
                        ? 'bg-white text-blue-700 shadow-sm ring-1 ring-gray-200'
                        : 'text-gray-500 hover:bg-white hover:text-gray-800'
                    }`}
                  >
                    内置模型
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!useBuiltinModel}
                    onClick={() => setUseBuiltinModel(false)}
                    className={`min-h-9 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      !useBuiltinModel
                        ? 'bg-white text-blue-700 shadow-sm ring-1 ring-gray-200'
                        : 'text-gray-500 hover:bg-white hover:text-gray-800'
                    }`}
                  >
                    自定义端点
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">模型 ID</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="grok-build"
                  required
                />
              </div>

              {!useBuiltinModel && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      API Backend
                    </label>
                    <div
                      className="grid grid-cols-3 rounded-lg border border-gray-200 bg-gray-50 p-1"
                      role="radiogroup"
                      aria-label="API Backend"
                    >
                      {API_BACKEND_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={apiBackend === option.value}
                          onClick={() => setApiBackend(option.value)}
                          className={`min-h-8 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                            apiBackend === option.value
                              ? 'bg-white text-blue-700 shadow-sm ring-1 ring-gray-200'
                              : 'text-gray-500 hover:bg-white hover:text-gray-800'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5">
                    <span className="text-sm font-medium text-gray-700">Backend Search</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={supportsBackendSearch}
                      aria-label="Backend Search"
                      onClick={() => setSupportsBackendSearch((value) => !value)}
                      className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
                        supportsBackendSearch ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                          supportsBackendSearch ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {!(type === TOOL_TYPES.GROK && useBuiltinModel) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API 地址</label>
              <input
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://api.example.com/v1"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="预置服务商描述"
              rows={3}
              required
            />
          </div>

          <div className="sticky bottom-0 z-10 -mx-6 mt-6 flex shrink-0 justify-end gap-3 border-t border-gray-200 bg-white px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              {preset ? '更新' : '添加'}
            </button>
          </div>
        </form>
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
