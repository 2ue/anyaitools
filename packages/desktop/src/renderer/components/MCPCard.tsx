import { useState } from 'react'
import type { MCPServer, MCPToolCapability, MCPToolType } from '@anyaitools/types'
import { Edit2, Trash2, Copy, Terminal, Globe2, Settings } from 'lucide-react'
import {
  ClaudeIcon,
  OpenAIIcon,
  GeminiIcon,
  OpenCodeIcon,
  OpenClawIcon,
  GrokIcon,
  McpIcon,
} from './icons/BrandIcons'
import { CARD_STYLES } from '../styles/card'

const APP_ICONS: Record<MCPToolType, React.ElementType> = {
  claude: ClaudeIcon,
  codex: OpenAIIcon,
  gemini: GeminiIcon,
  opencode: OpenCodeIcon,
  openclaw: OpenClawIcon,
  grok: GrokIcon,
}

interface MCPCardProps {
  server: MCPServer
  capabilities: MCPToolCapability[]
  onToggleTool: (tool: MCPToolType, enabled: boolean) => void
  onEdit: () => void
  onClone: () => void
  onDelete: () => void
}

function getEnabledTools(server: MCPServer): MCPToolType[] {
  if (server.enabledTools) {
    return Object.entries(server.enabledTools)
      .filter(([, enabled]) => enabled)
      .map(([tool]) => tool as MCPToolType)
  }
  return server.enabledApps || []
}

export default function MCPCard({
  server,
  capabilities,
  onToggleTool,
  onEdit,
  onClone,
  onDelete,
}: MCPCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const enabledTools = getEnabledTools(server)
  const transport = server.transport
  const isRemote = transport.type !== 'stdio'
  const command =
    transport.type === 'stdio'
      ? `${transport.command} ${transport.args.join(' ')}`.trim()
      : transport.url

  return (
    <div
      className={`${CARD_STYLES.base} ${CARD_STYLES.provider} group`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <McpIcon size={20} />
          <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
            {server.name}
          </h3>
          <span className="text-[10px] uppercase tracking-wide text-gray-500 border border-gray-200 rounded px-1.5 py-0.5">
            {isRemote ? transport.type : 'stdio'}
          </span>
        </div>
        <div className={`flex gap-1 transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="编辑"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClone}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="克隆"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mb-4 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
          {isRemote ? <Globe2 className="w-3.5 h-3.5" /> : <Terminal className="w-3.5 h-3.5" />}
          <span className="font-medium">{isRemote ? '远程地址' : '启动命令'}</span>
        </div>
        <code className="text-xs text-gray-700 bg-gray-50 px-2 py-1 rounded block overflow-x-auto whitespace-nowrap">
          {command || '未配置'}
        </code>
      </div>

      {transport.type === 'stdio' && transport.env && Object.keys(transport.env).length > 0 && (
        <div className="mb-4 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Settings className="w-3.5 h-3.5" />
            <span className="font-medium">环境变量</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(transport.env).map((key) => (
              <span
                key={key}
                className="text-[11px] text-gray-600 font-mono bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5"
              >
                {key}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between text-xs font-medium text-gray-600 mb-3">
          <span>按工具启用</span>
          <span className="text-gray-400">{enabledTools.length} 个工具</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {capabilities.map((capability) => {
            const tool = capability.tool
            const AppIcon = APP_ICONS[tool]
            const isEnabled = enabledTools.includes(tool)
            const isDeclaredSupported =
              server.supportedTools === undefined || server.supportedTools.includes(tool)
            const isSupported =
              capability.supported &&
              isDeclaredSupported &&
              capability.transportTypes.includes(transport.type)
            const unsupportedReason = !capability.supported
              ? capability.reason
              : !isDeclaredSupported
                ? '该 MCP 未声明支持此工具'
                : !capability.transportTypes.includes(transport.type)
                  ? '当前传输类型不受支持'
                  : capability.configPath
            return (
              <label
                key={tool}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                  !isSupported
                    ? 'bg-gray-50 border-gray-200 opacity-55 cursor-not-allowed'
                    : isEnabled
                      ? 'bg-blue-50 border-blue-300 hover:border-blue-400 cursor-pointer'
                      : 'bg-white border-gray-200 hover:border-gray-300 cursor-pointer'
                }`}
                title={unsupportedReason}
              >
                <input
                  type="checkbox"
                  checked={isEnabled}
                  disabled={!isSupported}
                  onChange={(event) => onToggleTool(tool, event.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                />
                <AppIcon size={16} />
                <span className="text-xs font-medium text-gray-700 truncate">
                  {capability.displayName}
                </span>
              </label>
            )
          })}
        </div>
      </div>

      {server.description && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500">{server.description}</p>
        </div>
      )}
    </div>
  )
}
