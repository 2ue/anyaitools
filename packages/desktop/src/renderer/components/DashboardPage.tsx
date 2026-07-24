import type { Provider } from '@anyaitools/types'
import { Package, Trash2, Settings } from 'lucide-react'
import {
  ClaudeIcon,
  OpenAIIcon,
  GeminiIcon,
  McpIcon,
  OpenCodeIcon,
  OpenClawIcon,
  GrokIcon,
} from './icons/BrandIcons'
import DashboardCard from './DashboardCard'

export type NavKey =
  | 'home'
  | 'claude'
  | 'codex'
  | 'gemini'
  | 'opencode'
  | 'openclaw'
  | 'grok'
  | 'mcp'
  | 'service-providers'
  | 'clean'
  | 'settings'
  | 'about'

interface ToolData {
  providers: Provider[]
  current?: Provider
  presetsCount: number
}

interface DashboardPageProps {
  claudeData: ToolData
  codexData: ToolData
  geminiData: ToolData
  opencodeData: ToolData
  openclawData: ToolData
  grokData: ToolData
  onEnterPage: (key: NavKey) => void
}

export default function DashboardPage({
  claudeData,
  codexData,
  geminiData,
  opencodeData,
  openclawData,
  grokData,
  onEnterPage,
}: DashboardPageProps) {
  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50">
      <div className="mx-auto max-w-[1000px] p-6 lg:p-8">
        {/* Compact product header */}
        <div className="mb-8 flex items-center gap-4 border-b border-gray-200 pb-6">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
            <span className="text-sm font-bold leading-none">AI</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">AnyAI Tools</h1>
            <p className="mt-1 text-sm text-gray-500">
              AI 代码助手配置管理工具 · 统一管理多个 AI 代码工具的 API 配置
            </p>
          </div>
        </div>

        {/* AI 代码助手区域 */}
        <div className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <span className="h-4 w-1 rounded-full bg-blue-600" />
            AI 代码助手
          </h2>
          {/* 响应式网格：2个工具显示2列，3+个工具显示3列，自动换行 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Claude Code */}
            <DashboardCard
              icon={ClaudeIcon}
              title="Claude Code"
              statusLines={[
                claudeData.current ? `已配置：${claudeData.current.name}` : '未配置',
                `${claudeData.providers.length} 个服务商`,
              ]}
              statusType={claudeData.current ? 'success' : 'warning'}
              onClick={() => onEnterPage('claude')}
              isBrandIcon
            />

            {/* Codex */}
            <DashboardCard
              icon={OpenAIIcon}
              title="Codex"
              statusLines={[
                codexData.current ? `已配置：${codexData.current.name}` : '未配置',
                `${codexData.providers.length} 个服务商`,
              ]}
              statusType={codexData.current ? 'success' : 'warning'}
              onClick={() => onEnterPage('codex')}
              isBrandIcon
            />

            {/* Gemini CLI */}
            <DashboardCard
              icon={GeminiIcon}
              title="Gemini CLI"
              statusLines={[
                geminiData.current ? `已配置：${geminiData.current.name}` : '未配置',
                `${geminiData.providers.length} 个服务商`,
              ]}
              statusType={geminiData.current ? 'success' : 'warning'}
              onClick={() => onEnterPage('gemini')}
              isBrandIcon
            />

            {/* OpenCode */}
            <DashboardCard
              icon={OpenCodeIcon}
              title="OpenCode"
              statusLines={[
                opencodeData.current ? `已配置：${opencodeData.current.name}` : '未配置',
                `${opencodeData.providers.length} 个服务商`,
              ]}
              statusType={opencodeData.current ? 'success' : 'warning'}
              onClick={() => onEnterPage('opencode')}
              isBrandIcon
            />

            {/* OpenClaw */}
            <DashboardCard
              icon={OpenClawIcon}
              title="OpenClaw"
              statusLines={[
                openclawData.current ? `已配置：${openclawData.current.name}` : '未配置',
                `${openclawData.providers.length} 个服务商`,
              ]}
              statusType={openclawData.current ? 'success' : 'warning'}
              onClick={() => onEnterPage('openclaw')}
              isBrandIcon
            />

            {/* Grok Build */}
            <DashboardCard
              icon={GrokIcon}
              title="Grok Build"
              statusLines={[
                grokData.current ? `已配置：${grokData.current.name}` : '未配置',
                `${grokData.providers.length} 个服务商`,
              ]}
              statusType={grokData.current ? 'success' : 'warning'}
              onClick={() => onEnterPage('grok')}
              isBrandIcon
            />
          </div>
        </div>

        {/* 配置与工具区域 */}
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
            <span className="h-4 w-1 rounded-full bg-gray-400" />
            配置与工具
          </h2>
          {/* 响应式网格：自动适应卡片数量 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* MCP 服务器 */}
            <DashboardCard
              icon={McpIcon}
              title="MCP 服务器"
              statusLines={['Model Context Protocol', '扩展 AI 工具能力']}
              statusType="info"
              onClick={() => onEnterPage('mcp')}
              isBrandIcon
            />

            {/* 预置服务商 */}
            <DashboardCard
              icon={Package}
              title="预置服务商"
              statusLines={[
                `${
                  claudeData.presetsCount +
                  codexData.presetsCount +
                  geminiData.presetsCount +
                  opencodeData.presetsCount +
                  openclawData.presetsCount +
                  grokData.presetsCount
                } 个模板`,
                '快速添加服务商',
              ]}
              statusType="info"
              onClick={() => onEnterPage('service-providers')}
            />

            {/* 清理工具 */}
            <DashboardCard
              icon={Trash2}
              title="清理工具"
              statusLines={['Claude Code 历史数据', '释放存储空间']}
              statusType="info"
              onClick={() => onEnterPage('clean')}
            />

            {/* 设置 & 关于 */}
            <DashboardCard
              icon={Settings}
              title="设置 & 关于"
              statusLines={['全局配置', '应用信息']}
              statusType="info"
              onClick={() => onEnterPage('settings')}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
