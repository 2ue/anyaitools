import type { Provider } from '@anyaitools/types'
import ToolPage from './ToolPage'
import { GrokIcon } from './icons/BrandIcons'

interface GrokPageProps {
  providers: Provider[]
  currentProvider?: Provider
  onAdd: () => void
  onSwitch: (id: string) => void
  onEdit: (provider: Provider) => void
  onDelete: (id: string, name: string) => void
  onClone: (provider: Provider) => void
}

export default function GrokPage(props: GrokPageProps) {
  return <ToolPage toolType="grok" toolName="Grok Build" icon={GrokIcon} {...props} />
}
