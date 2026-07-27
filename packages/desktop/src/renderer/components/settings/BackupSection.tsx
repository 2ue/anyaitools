/**
 * 本地加密备份配置区块
 */

import { useState } from 'react'
import { FileUp, FileDown, HardDrive, AlertTriangle, KeyRound, X } from 'lucide-react'
import { ConfirmDialog } from '../dialogs/ConfirmDialog'

interface BackupSectionProps {
  onSuccess: (message: string) => void
  onError: (title: string, message: string) => void
  onDataChanged?: () => void
}

export default function BackupSection({ onSuccess, onError, onDataChanged }: BackupSectionProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [showImportConfirm, setShowImportConfirm] = useState(false)
  const [showExportPassword, setShowExportPassword] = useState(false)
  const [showImportPassword, setShowImportPassword] = useState(false)
  const [exportDir, setExportDir] = useState<string | null>(null)
  const [importSource, setImportSource] = useState<string | null>(null)
  const [importFiles, setImportFiles] = useState<string[]>([])
  const [exportPassword, setExportPassword] = useState('')
  const [exportPasswordConfirm, setExportPasswordConfirm] = useState('')
  const [importPassword, setImportPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [isLegacyImport, setIsLegacyImport] = useState(false)

  const resetExportPasswordState = () => {
    setShowExportPassword(false)
    setExportDir(null)
    setExportPassword('')
    setExportPasswordConfirm('')
    setPasswordError('')
  }

  const resetImportPasswordState = () => {
    setShowImportPassword(false)
    setImportPassword('')
    setPasswordError('')
  }

  const resetImportState = () => {
    resetImportPasswordState()
    setShowImportConfirm(false)
    setImportSource(null)
    setImportFiles([])
    setIsLegacyImport(false)
  }

  const handleExport = async () => {
    try {
      const targetDir = await window.electronAPI.importExport.selectFolder('选择导出目录')
      if (!targetDir) return

      setExportDir(targetDir)
      setExportPassword('')
      setExportPasswordConfirm('')
      setPasswordError('')
      setShowExportPassword(true)
    } catch (error) {
      onError('导出失败', (error as Error).message)
    }
  }

  const handleExportWithPassword = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!exportDir) return

    const password = exportPassword.trim()
    if (!password) {
      setPasswordError('请输入导出密码')
      return
    }
    if (password !== exportPasswordConfirm.trim()) {
      setPasswordError('两次输入的密码不一致')
      return
    }

    try {
      setIsExporting(true)
      const result = await window.electronAPI.importExport.exportConfig(exportDir, password)
      if (result.success) {
        onSuccess(
          `加密备份已导出：${result.backupPath}\n包含文件：${result.exportedFiles.join(', ')}`
        )
        resetExportPasswordState()
      }
    } catch (error) {
      onError('导出失败', (error as Error).message)
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportClick = async () => {
    try {
      const source =
        await window.electronAPI.importExport.selectImportSource('选择备份文件或旧导出目录')
      if (!source) return

      const validation = await window.electronAPI.importExport.validateImportDir(source)
      if (!validation.valid) {
        onError('导入失败', validation.message || '无效的导入源')
        return
      }

      setImportSource(source)
      setIsLegacyImport(validation.legacy === true)

      if (validation.requiresPassword) {
        setImportPassword('')
        setPasswordError('')
        setShowImportPassword(true)
        return
      }

      setImportFiles(validation.foundFiles)
      setShowImportConfirm(true)
    } catch (error) {
      onError('导入失败', (error as Error).message)
    }
  }

  const handleImportPasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!importSource) return

    const password = importPassword.trim()
    if (!password) {
      setPasswordError('请输入备份密码')
      return
    }

    try {
      const validation = await window.electronAPI.importExport.validateImportDir(
        importSource,
        password
      )
      if (!validation.valid) {
        setPasswordError(validation.message || '备份密码错误或文件损坏')
        return
      }

      setImportFiles(validation.foundFiles)
      setIsLegacyImport(validation.legacy === true)
      setShowImportPassword(false)
      setShowImportConfirm(true)
    } catch (error) {
      setPasswordError((error as Error).message)
    }
  }

  const handleImportConfirm = async () => {
    if (!importSource) return
    try {
      setIsImporting(true)
      setShowImportConfirm(false)
      const result = await window.electronAPI.importExport.importConfig(
        importSource,
        importPassword.trim() || undefined
      )
      if (result.success) {
        let message = `配置已导入\n导入文件：${result.importedFiles.join(', ')}`
        if (result.backupPaths.length > 0) {
          message += `\n\n备份文件：\n${result.backupPaths.join('\n')}`
        }
        onSuccess(message)
        onDataChanged?.()
      }
    } catch (error) {
      onError('导入失败', (error as Error).message)
    } finally {
      setIsImporting(false)
      resetImportState()
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-2">
        <HardDrive className="w-5 h-5 text-blue-600" />
        <h2 className="text-xl font-semibold tracking-tight text-gray-900">本地备份</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex flex-col items-center gap-2 px-4 py-4 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileUp className="w-5 h-5" />
            <span className="text-sm font-medium">
              {isExporting ? '导出中...' : '导出加密备份'}
            </span>
            <span className="text-xs text-blue-500">保存到本地文件</span>
          </button>

          <button
            onClick={handleImportClick}
            disabled={isImporting}
            className="flex flex-col items-center gap-2 px-4 py-4 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown className="w-5 h-5" />
            <span className="text-sm font-medium">{isImporting ? '导入中...' : '导入备份'}</span>
            <span className="text-xs text-blue-500">从备份文件恢复</span>
          </button>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
          <p className="text-xs text-yellow-700 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            导出备份会使用密码加密；忘记密码将无法恢复备份
          </p>
        </div>
      </div>

      {showExportPassword && (
        <PasswordDialog
          title="设置导出密码"
          description="备份内容将整体加密。"
          password={exportPassword}
          confirmPassword={exportPasswordConfirm}
          error={passwordError}
          busy={isExporting}
          submitText="导出备份"
          onPasswordChange={setExportPassword}
          onConfirmPasswordChange={setExportPasswordConfirm}
          onSubmit={handleExportWithPassword}
          onCancel={resetExportPasswordState}
          requireConfirm
        />
      )}

      {showImportPassword && (
        <PasswordDialog
          title="输入备份密码"
          description="密码正确后会显示备份中包含的配置。"
          password={importPassword}
          error={passwordError}
          busy={isImporting}
          submitText="验证密码"
          onPasswordChange={setImportPassword}
          onSubmit={handleImportPasswordSubmit}
          onCancel={resetImportState}
        />
      )}

      <ConfirmDialog
        show={showImportConfirm}
        title="确认导入配置"
        message={
          <div className="space-y-3">
            <p className="text-red-600 font-medium flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              此操作将覆盖备份中包含的本地配置。
            </p>
            <div className="text-sm text-gray-700">
              <p className="font-medium">导入源：</p>
              <p className="text-gray-600 break-all">{importSource}</p>
            </div>
            <div className="text-sm text-gray-700">
              <p className="font-medium">找到配置文件：</p>
              <ul className="list-disc list-inside text-gray-600">
                {importFiles.map((file) => (
                  <li key={file}>{file}</li>
                ))}
              </ul>
            </div>
            {isLegacyImport && <p className="text-sm text-amber-600">这是旧版未加密目录格式。</p>}
            <p className="text-sm text-gray-500">当前配置将自动备份。</p>
          </div>
        }
        confirmText="确认导入"
        cancelText="取消"
        onConfirm={handleImportConfirm}
        onCancel={resetImportState}
        danger
      />
    </div>
  )
}

interface PasswordDialogProps {
  title: string
  description: string
  password: string
  confirmPassword?: string
  error?: string
  busy?: boolean
  submitText: string
  requireConfirm?: boolean
  onPasswordChange: (value: string) => void
  onConfirmPasswordChange?: (value: string) => void
  onSubmit: (event: React.FormEvent) => void
  onCancel: () => void
}

function PasswordDialog({
  title,
  description,
  password,
  confirmPassword = '',
  error = '',
  busy = false,
  submitText,
  requireConfirm = false,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  onCancel,
}: PasswordDialogProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={busy}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <p className="text-sm text-gray-600">{description}</p>

          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">密码</span>
            <input
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              disabled={busy}
            />
          </label>

          {requireConfirm && (
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">确认密码</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => onConfirmPasswordChange?.(event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={busy}
              />
            </label>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={busy}
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={busy}
            >
              {busy ? '处理中...' : submitText}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
