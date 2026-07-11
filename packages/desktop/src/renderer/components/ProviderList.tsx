import { Check, Copy, Edit2, Globe, Play, Trash2 } from 'lucide-react'
import type { Provider } from '@anyaitools/types'
import { BRAND_COLORS, type ToolType } from '../styles/brand-colors'

interface Props {
  providers: Provider[]
  currentProviderId: string | undefined
  tool: ToolType
  onSwitch: (id: string) => void
  onEdit: (provider: Provider) => void
  onDelete: (id: string, name: string) => void
  onClone: (provider: Provider) => void
}

export default function ProviderList({
  providers,
  currentProviderId,
  tool,
  onSwitch,
  onEdit,
  onDelete,
  onClone,
}: Props) {
  if (providers.length === 0) {
    return (
      <div className="border-2 border-dashed border-gray-200 py-12 text-center rounded-lg">
        <Globe className="mx-auto mb-3 h-7 w-7 text-gray-300" />
        <p className="font-medium text-gray-500">暂无服务商</p>
        <p className="mt-1 text-sm text-gray-400">点击"添加"按钮创建配置</p>
      </div>
    )
  }

  const theme = BRAND_COLORS[tool]

  return (
    <div className="space-y-2">
      {providers.map((provider) => {
        const isCurrent = provider.id === currentProviderId

        return (
          <div
            key={provider.id}
            className={`rounded-lg border bg-white p-3 transition-all hover:shadow-sm ${
              isCurrent
                ? `${theme.border} ring-1 ${theme.ring}`
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex min-w-0 items-center gap-2">
                  <h3
                    className="truncate text-sm font-semibold text-gray-900"
                    title={provider.name}
                  >
                    {provider.name}
                  </h3>
                  {isCurrent && (
                    <span
                      className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${theme.bgLight} ${theme.textDark}`}
                    >
                      <Check className="h-3 w-3" />
                      激活中
                    </span>
                  )}
                </div>
                <div className="flex min-w-0 flex-col gap-1 text-xs text-gray-500 sm:flex-row sm:items-center sm:gap-3">
                  <span className="truncate font-mono" title={provider.baseUrl}>
                    {provider.baseUrl}
                  </span>
                  {provider.desc && (
                    <span
                      className="truncate sm:border-l sm:border-gray-200 sm:pl-3"
                      title={provider.desc}
                    >
                      {provider.desc}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-shrink-0 items-center gap-1">
                {!isCurrent && (
                  <button
                    onClick={() => onSwitch(provider.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                    title="切换到此服务商"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => onClone(provider)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                  title="克隆服务商"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onEdit(provider)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                  title="编辑服务商"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(provider.id, provider.name)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  title="删除服务商"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
