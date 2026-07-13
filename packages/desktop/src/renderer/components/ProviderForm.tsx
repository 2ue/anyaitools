/**
 * ProviderForm - 服务商表单组件
 *
 * 按照新架构:Provider 没有 type 字段,由父组件区分工具类型
 */

import { useState, useEffect } from 'react'
import type {
  Provider,
  AddProviderInput,
  EditProviderInput,
  PresetTemplate,
  ApiBackend,
} from '@anyaitools/types'
import { BUTTON_STYLES } from '../styles/button'

const API_BACKEND_OPTIONS: Array<{ value: ApiBackend; label: string }> = [
  { value: 'chat_completions', label: 'Chat Completions' },
  { value: 'responses', label: 'Responses' },
  { value: 'messages', label: 'Messages' },
]

interface Props {
  provider?: Provider
  preset?: PresetTemplate
  isClone?: boolean
  existingProviders?: Provider[]
  tool?: 'codex' | 'claude' | 'gemini' | 'opencode' | 'openclaw' | 'grok'
  onSubmit: (input: AddProviderInput | EditProviderInput) => void | Promise<void>
  onCancel: () => void
}

export default function ProviderForm({
  provider,
  preset,
  isClone = false,
  existingProviders = [],
  tool = 'codex',
  onSubmit,
  onCancel,
}: Props) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [apiBackend, setApiBackend] = useState<ApiBackend>('chat_completions')
  const [supportsBackendSearch, setSupportsBackendSearch] = useState(false)
  const [useBuiltinModel, setUseBuiltinModel] = useState(false)
  const [clearApiKey, setClearApiKey] = useState(false)
  const [nameError, setNameError] = useState('')

  useEffect(() => {
    console.log('[ProviderForm] useEffect triggered', { provider, preset })
    if (provider) {
      // 编辑/克隆模式:预填充 provider 数据
      console.log('[ProviderForm] Using provider data:', provider)
      setName(provider.name)
      setDesc(provider.desc || '')
      setBaseUrl(provider.baseUrl)
      setApiKey('') // 编辑时 API Key 不显示,需重新输入
      setModel(provider.model || '')
      setApiBackend(provider.apiBackend || 'chat_completions')
      setSupportsBackendSearch(provider.supportsBackendSearch ?? false)
      setUseBuiltinModel(tool === 'grok' && !provider.baseUrl.trim())
      setClearApiKey(false)
    } else if (preset) {
      // Preset 模式:预填充 preset 数据
      console.log('[ProviderForm] Using preset data:', preset)
      setName(preset.name)
      // 不继承预置描述,留空让用户自行填写
      setDesc('')
      setBaseUrl(preset.baseUrl)
      setApiKey('')
      setModel(preset.model || '')
      setApiBackend(preset.apiBackend || 'chat_completions')
      setSupportsBackendSearch(preset.supportsBackendSearch ?? false)
      setUseBuiltinModel(tool === 'grok' && !preset.baseUrl.trim())
      setClearApiKey(false)
    } else {
      // 空白模式
      console.log('[ProviderForm] Using blank mode')
      setName('')
      setDesc('')
      setBaseUrl('')
      setApiKey('')
      setModel('')
      setApiBackend('chat_completions')
      setSupportsBackendSearch(false)
      setUseBuiltinModel(false)
      setClearApiKey(false)
    }
  }, [provider, preset, tool])

  // 检查名称是否重复
  const checkNameConflict = (inputName: string): boolean => {
    if (!inputName.trim()) return false

    // 编辑模式且克隆模式：需要排除正在编辑的服务商
    const currentId = provider && !isClone ? provider.id : null

    return existingProviders.some((p) => p.name === inputName.trim() && p.id !== currentId)
  }

  // 处理名称输入变化
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value
    setName(newName)

    // 实时检查名称冲突
    if (newName.trim() && checkNameConflict(newName)) {
      setNameError(`服务商名称已存在: ${newName.trim()}`)
    } else {
      setNameError('')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // 提交前再次检查名称冲突
    if (checkNameConflict(name)) {
      setNameError(`服务商名称已存在: ${name.trim()}`)
      return
    }

    // 计算最终 API Key:
    // - 新增模式(provider 为空): 必填,直接使用表单值
    // - 编辑模式(provider 存在且非克隆): 为空表示不修改,不向上层传 apiKey
    // - 克隆模式(provider 存在且 isClone): 为空表示沿用原 provider 的 apiKey
    let finalApiKey: string | undefined

    if (tool === 'grok' && useBuiltinModel) {
      finalApiKey = ''
    } else if (tool === 'grok' && clearApiKey) {
      finalApiKey = ''
    } else if (!provider) {
      // 新增模式(包括从预置添加): HTML5 required 已经保证有值
      finalApiKey = apiKey.trim()
    } else if (isClone) {
      // 克隆模式: 允许留空表示复用原有 Key
      finalApiKey = apiKey.trim() || provider.apiKey
    } else {
      // 编辑模式: 留空表示不修改
      finalApiKey = apiKey.trim() || undefined
    }

    const trimmedName = name.trim()
    const trimmedDesc = desc.trim()

    const baseInput = {
      name: trimmedName,
      desc: trimmedDesc || undefined,
      baseUrl: baseUrl.trim(),
      ...(finalApiKey !== undefined ? { apiKey: finalApiKey } : {}),
      ...(tool === 'grok'
        ? {
            model: model.trim(),
            ...(useBuiltinModel ? {} : { apiBackend, supportsBackendSearch }),
          }
        : {}),
    }

    const input: AddProviderInput | EditProviderInput = baseInput

    onSubmit(input)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {preset && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">使用配置：</span> {preset.name}
          </p>
          <p className="text-xs text-blue-600 mt-1">{preset.description}</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          服务商名称 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={handleNameChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
            nameError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
          }`}
          placeholder="例如：我的 Anthropic API"
          required
        />
        {nameError && <p className="text-sm text-red-600 mt-1">{nameError}</p>}
      </div>

      {tool === 'grok' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">模型来源</label>
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
                  setApiKey('')
                  setClearApiKey(true)
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
                onClick={() => {
                  setUseBuiltinModel(false)
                  setClearApiKey(false)
                }}
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              模型 ID <span className="text-red-500">*</span>
            </label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
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

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">描述(可选)</label>
        <input
          type="text"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="例如: 官方 Anthropic API, 只读环境等"
        />
      </div>

      {!(tool === 'grok' && useBuiltinModel) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            API 地址 <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://api.anthropic.com"
            required
          />
        </div>
      )}

      {!(tool === 'grok' && useBuiltinModel) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            API 密钥 {provider && <span className="text-gray-500 text-xs">(留空不修改)</span>}
            {!provider && tool !== 'grok' && <span className="text-red-500">*</span>}
            {!provider && tool === 'grok' && <span className="text-gray-500 text-xs">(可选)</span>}
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={tool === 'grok' ? 'xai-...' : 'sk-ant-...'}
            required={!provider && tool !== 'grok'}
            disabled={clearApiKey}
          />
          {provider && (
            <p className="text-xs text-gray-500 mt-1">编辑时不显示现有密钥,如需修改请重新输入</p>
          )}
          {tool === 'grok' && provider && !isClone && (
            <button
              type="button"
              role="switch"
              aria-checked={clearApiKey}
              onClick={() => {
                setClearApiKey((value) => !value)
                setApiKey('')
              }}
              className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-gray-600"
            >
              <span
                aria-hidden="true"
                className={`relative h-4 w-7 rounded-full transition-colors ${
                  clearApiKey ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
                    clearApiKey ? 'translate-x-3' : 'translate-x-0'
                  }`}
                />
              </span>
              清除已保存密钥
            </button>
          )}
        </div>
      )}

      <div className="flex gap-2 justify-end pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
        >
          取消
        </button>
        <button type="submit" className={BUTTON_STYLES.primary}>
          {isClone ? '克隆' : provider ? '保存' : '添加'}
        </button>
      </div>
    </form>
  )
}
