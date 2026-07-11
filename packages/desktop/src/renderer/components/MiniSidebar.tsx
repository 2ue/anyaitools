import * as Tooltip from '@radix-ui/react-tooltip'
import { Home, Package, Trash2, Settings, Info } from 'lucide-react'
import {
  ClaudeIcon,
  OpenAIIcon,
  GeminiIcon,
  McpIcon,
  OpenCodeIcon,
  OpenClawIcon,
} from './icons/BrandIcons'
import type { NavKey } from './DashboardPage'

interface MiniSidebarProps {
  activeKey: NavKey
  onNavigate: (key: NavKey) => void
}

interface NavItem {
  key: NavKey
  icon: React.ElementType
  label: string
  isBrandIcon?: boolean
}

interface NavDivider {
  type: 'divider'
}

interface NavSpacer {
  type: 'spacer'
}

type NavElement = NavItem | NavDivider | NavSpacer

export default function MiniSidebar({ activeKey, onNavigate }: MiniSidebarProps) {
  const items: NavElement[] = [
    { key: 'home', icon: Home, label: '返回首页' },
    { type: 'divider' },
    { key: 'claude', icon: ClaudeIcon, label: 'Claude Code', isBrandIcon: true },
    { key: 'codex', icon: OpenAIIcon, label: 'Codex', isBrandIcon: true },
    { key: 'gemini', icon: GeminiIcon, label: 'Gemini CLI', isBrandIcon: true },
    { key: 'opencode', icon: OpenCodeIcon, label: 'OpenCode', isBrandIcon: true },
    { key: 'openclaw', icon: OpenClawIcon, label: 'OpenClaw', isBrandIcon: true },
    { key: 'mcp', icon: McpIcon, label: 'MCP 服务器', isBrandIcon: true },
    { key: 'service-providers', icon: Package, label: '预置服务商' },
    { key: 'clean', icon: Trash2, label: '清理工具' },
    { type: 'spacer' },
    { key: 'settings', icon: Settings, label: '设置' },
    { key: 'about', icon: Info, label: '关于' },
  ]

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className="z-10 flex w-[68px] flex-col items-center border-r border-gray-200 bg-gray-50 py-4 shadow-[2px_0_8px_-4px_rgba(0,0,0,0.1)]">
        {items.map((item, index) => {
          // 分隔线
          if ('type' in item && item.type === 'divider') {
            return <div key={`divider-${index}`} className="w-8 h-px bg-gray-200 my-2" />
          }

          // 弹性空间
          if ('type' in item && item.type === 'spacer') {
            return <div key={`spacer-${index}`} className="flex-1" />
          }

          // 导航项
          const navItem = item as NavItem
          const Icon = navItem.icon
          const isActive = activeKey === navItem.key

          return (
            <Tooltip.Root key={navItem.key}>
              <Tooltip.Trigger asChild>
                <button
                  onClick={() => onNavigate(navItem.key)}
                  className={`
                    group relative mb-2 flex h-10 w-10 items-center justify-center rounded-lg
                    transition-all duration-200
                    ${
                      isActive
                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-gray-200'
                        : 'text-gray-500 hover:bg-white hover:text-gray-900 hover:shadow-sm'
                    }
                  `}
                >
                  {isActive && (
                    <span className="absolute -left-3.5 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-blue-600" />
                  )}

                  {navItem.isBrandIcon ? (
                    <Icon
                      size={20}
                      className={isActive ? '' : 'opacity-70 group-hover:opacity-100'}
                    />
                  ) : (
                    <Icon
                      className={`h-5 w-5 ${isActive ? '' : 'opacity-70 group-hover:opacity-100'}`}
                    />
                  )}
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  side="right"
                  sideOffset={16}
                  className="z-50 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white shadow-xl"
                >
                  {navItem.label}
                  <Tooltip.Arrow className="fill-gray-900" width={10} height={5} />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          )
        })}
      </div>
    </Tooltip.Provider>
  )
}
