import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react'

interface AlertDialogProps {
  show: boolean
  title: string
  message: string
  type?: 'success' | 'error' | 'warning' | 'info'
  confirmText?: string
  onClose: () => void
}

export default function AlertDialog({
  show,
  title,
  message,
  type = 'info',
  confirmText = '确定',
  onClose,
}: AlertDialogProps) {
  if (!show) return null

  const iconMap = {
    success: <CheckCircle className="w-6 h-6 text-green-500" />,
    error: <XCircle className="w-6 h-6 text-red-500" />,
    warning: <AlertTriangle className="w-6 h-6 text-amber-500" />,
    info: <Info className="w-6 h-6 text-blue-500" />,
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="flex max-h-[90vh] min-h-0 w-full max-w-md flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">{iconMap[type]}</div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-600 break-all whitespace-pre-wrap">{message}</p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 justify-end border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
