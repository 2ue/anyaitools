/**
 * MCPForm - MCP 服务器表单组件
 *
 * 字段映射（MCP 特有）：
 * - name: 服务器名称
 * - command: 启动命令（如 npx, node）
 * - args: 命令参数数组
 * - env: 环境变量（可选）
 * - description: 描述（可选）
 */

import { useState, useEffect } from 'react'
import type { MCPServer } from '@anyaitools/types'
import { BUTTON_STYLES } from '../styles/button'
import SelectMenu from './SelectMenu'

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
  server?: MCPServer
  preset?: { name: string; command: string; args: string[]; description: string }
  isClone?: boolean
  existingServers?: MCPServer[]
  onSubmit: (input: MCPFormData) => void | Promise<void>
  onCancel: () => void
}

export default function MCPForm({
  server,
  preset,
  isClone = false,
  existingServers = [],
  onSubmit,
  onCancel,
}: Props) {
  const [name, setName] = useState('')
  const [transportType, setTransportType] = useState<MCPFormData['transportType']>('stdio')
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState('') // 字符串形式，换行分隔
  const [env, setEnv] = useState('') // JSON 字符串
  const [url, setUrl] = useState('')
  const [headers, setHeaders] = useState('')
  const [description, setDescription] = useState('')
  const [nameError, setNameError] = useState('')
  const [envError, setEnvError] = useState('')
  const [headersError, setHeadersError] = useState('')

  useEffect(() => {
    if (server) {
      // 编辑/克隆模式
      setName(server.name)
      setTransportType(server.transport.type === 'http' ? 'streamable-http' : server.transport.type)
      setCommand(server.transport.type === 'stdio' ? server.transport.command : '')
      setArgs(server.transport.type === 'stdio' ? server.transport.args.join('\n') : '')
      setEnv(
        server.transport.type === 'stdio' && server.transport.env
          ? JSON.stringify(server.transport.env, null, 2)
          : ''
      )
      setUrl(server.transport.type === 'stdio' ? '' : server.transport.url)
      setHeaders(
        server.transport.type === 'stdio' || !server.transport.headers
          ? ''
          : JSON.stringify(server.transport.headers, null, 2)
      )
      setHeadersError('')
      setDescription(server.description || '')
    } else if (preset) {
      // 预设模式
      setName(preset.name)
      setTransportType('stdio')
      setCommand(preset.command)
      setArgs(preset.args.join('\n'))
      setEnv('')
      setUrl('')
      setHeaders('')
      setHeadersError('')
      setDescription(preset.description)
    } else {
      // 空白模式
      setName('')
      setTransportType('stdio')
      setCommand('')
      setArgs('')
      setEnv('')
      setUrl('')
      setHeaders('')
      setHeadersError('')
      setDescription('')
    }
  }, [server, preset])

  // 检查名称是否重复
  const checkNameConflict = (inputName: string): boolean => {
    if (!inputName.trim()) return false

    // 编辑模式且非克隆模式：需要排除正在编辑的服务器
    const currentId = server && !isClone ? server.id : null

    return existingServers.some((s) => s.name === inputName.trim() && s.id !== currentId)
  }

  // 处理名称输入变化
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value
    setName(newName)

    // 实时检查名称冲突
    if (newName.trim() && checkNameConflict(newName)) {
      setNameError(`MCP 服务器名称已存在: ${newName.trim()}`)
    } else {
      setNameError('')
    }
  }

  // 验证环境变量 JSON
  const validateEnv = (envString: string): boolean => {
    if (!envString.trim()) {
      setEnvError('')
      return true
    }

    try {
      JSON.parse(envString)
      setEnvError('')
      return true
    } catch (error) {
      setEnvError('环境变量必须是有效的 JSON 格式')
      return false
    }
  }

  const handleEnvChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newEnv = e.target.value
    setEnv(newEnv)
    validateEnv(newEnv)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // 提交前再次检查名称冲突
    if (checkNameConflict(name)) {
      setNameError(`MCP 服务器名称已存在: ${name.trim()}`)
      return
    }

    // 验证环境变量
    if (!validateEnv(env)) {
      return
    }
    let parsedHeaders: string | undefined
    if (headers.trim()) {
      try {
        const value = JSON.parse(headers)
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error()
        parsedHeaders = JSON.stringify(value)
        setHeadersError('')
      } catch {
        setHeadersError('请求头必须是有效的 JSON 对象')
        return
      }
    }

    // 构造提交数据
    onSubmit({
      name: name.trim(),
      transportType,
      command: command.trim(),
      args: args.trim(),
      env: env.trim(),
      url: url.trim(),
      headers: parsedHeaders || '',
      description: description.trim(),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {preset && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">使用预设：</span> {preset.name}
          </p>
          <p className="text-xs text-blue-600 mt-1">{preset.description}</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          服务器名称 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={handleNameChange}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
            nameError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
          }`}
          placeholder="例如：filesystem"
          required
        />
        {nameError && <p className="text-sm text-red-600 mt-1">{nameError}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">传输类型</label>
        <SelectMenu
          value={transportType}
          onChange={(value) => setTransportType(value)}
          ariaLabel="传输类型"
          options={[
            { value: 'stdio', label: '本地进程（stdio）' },
            { value: 'sse', label: '远程 SSE' },
            { value: 'streamable-http', label: '远程 Streamable HTTP' },
          ]}
        />
      </div>

      {transportType === 'stdio' ? (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              启动命令 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="npx"
              required
            />
            <p className="text-xs text-gray-500 mt-1">启动 MCP 服务器的命令，如 npx、node 等</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">命令参数</label>
            <textarea
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              placeholder="-y&#10;@modelcontextprotocol/server-filesystem&#10;/path/to/allowed/files"
              rows={4}
            />
            <p className="text-xs text-gray-500 mt-1">每行一个参数</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              环境变量 <span className="text-gray-500 text-xs">(可选)</span>
            </label>
            <textarea
              value={env}
              onChange={handleEnvChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 font-mono text-sm ${
                envError
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
              placeholder='{\n  "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_...",\n  "API_KEY": "your-key"\n}'
              rows={4}
            />
            {envError && <p className="text-sm text-red-600 mt-1">{envError}</p>}
            <p className="text-xs text-gray-500 mt-1">JSON 格式的环境变量，如需配置 API Key 等</p>
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              MCP 地址 <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://mcp.example.com/mcp"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">请求头（可选）</label>
            <textarea
              value={headers}
              onChange={(e) => {
                setHeaders(e.target.value)
                setHeadersError('')
              }}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 font-mono text-sm ${
                headersError
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
              placeholder='{\n  "Authorization": "Bearer ..."\n}'
              rows={4}
            />
            {headersError && <p className="text-sm text-red-600 mt-1">{headersError}</p>}
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          描述 <span className="text-gray-500 text-xs">(可选)</span>
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="简短描述此 MCP 服务器的用途"
        />
      </div>

      <div className="sticky bottom-0 z-10 -mx-6 mt-6 flex shrink-0 justify-end gap-2 border-t border-gray-200 bg-white px-6 py-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
        >
          取消
        </button>
        <button type="submit" className={BUTTON_STYLES.primary}>
          {isClone ? '克隆' : server ? '保存' : '添加'}
        </button>
      </div>
    </form>
  )
}
