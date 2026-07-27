/**
 * 配置导入导出功能
 *
 * 新格式：导出单个加密备份文件，导入时用密码解密后恢复到 ~/.anyaitools/
 * 兼容旧格式：仍可导入包含 loose json / json.bak 的旧目录。
 */

import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { getAnyAIToolsDir } from './paths.js'
import { fileExists, ensureDir, writeJSON } from './utils/file.js'
import { backupConfig } from './sync/merge.js'
import { loadVersion } from './version.js'

const BACKUP_FORMAT = 'anyaitools.encrypted-backup'
const BACKUP_FORMAT_VERSION = 1
const BACKUP_SCHEMA_VERSION = 1
const BACKUP_FILE_EXTENSION = '.anyaitools-backup'
const MAX_BACKUP_FILE_BYTES = 50 * 1024 * 1024
const MAX_DECRYPTED_PAYLOAD_BYTES = 50 * 1024 * 1024

const ENCRYPTION_ALGORITHM = 'aes-256-gcm'
const KDF = 'pbkdf2-sha256'
const KEY_LENGTH = 32
const IV_LENGTH = 12
const SALT_LENGTH = 32
const TAG_LENGTH = 16
const PBKDF2_ITERATIONS = 300000

const CONFIG_ENTRIES = [
  { tool: 'codex', filename: 'codex.json', displayName: 'Codex', kind: 'provider' },
  { tool: 'claude', filename: 'claude.json', displayName: 'Claude Code', kind: 'provider' },
  { tool: 'gemini', filename: 'gemini.json', displayName: 'Gemini CLI', kind: 'provider' },
  { tool: 'opencode', filename: 'opencode.json', displayName: 'OpenCode', kind: 'provider' },
  { tool: 'openclaw', filename: 'openclaw.json', displayName: 'OpenClaw', kind: 'provider' },
  { tool: 'grok', filename: 'grok.json', displayName: 'Grok Build', kind: 'provider' },
  { tool: 'mcp', filename: 'mcp.json', displayName: 'MCP', kind: 'mcp' },
] as const
const APP_VERSION = loadVersion()

type ConfigEntry = (typeof CONFIG_ENTRIES)[number]
type SupportedConfigFile = ConfigEntry['filename']
type SupportedTool = ConfigEntry['tool']

interface BackupPayloadConfig {
  filename: SupportedConfigFile
  content: unknown
}

interface BackupPayload {
  schemaVersion: number
  appVersion: string
  createdAt: string
  configs: Partial<Record<SupportedTool, BackupPayloadConfig>>
}

interface EncryptedBackupEnvelope {
  format: typeof BACKUP_FORMAT
  formatVersion: number
  createdAt: string
  encryption: {
    algorithm: typeof ENCRYPTION_ALGORITHM
    kdf: typeof KDF
    iterations: number
    salt: string
    iv: string
    tag: string
  }
  payload: string
}

interface PreparedConfig {
  entry: ConfigEntry
  content: unknown
  sourcePath?: string
}

/**
 * 导出验证结果
 */
export interface ExportValidation {
  valid: boolean
  message?: string
  missingFiles?: string[]
  foundFiles?: string[]
}

/**
 * 导入验证结果
 */
export interface ImportValidation {
  valid: boolean
  message?: string
  foundFiles: string[]
  requiresPassword?: boolean
  encrypted?: boolean
  legacy?: boolean
}

/**
 * 导出结果
 */
export interface ExportResult {
  success: boolean
  targetDir: string
  backupPath: string
  exportedFiles: string[]
}

/**
 * 导入结果
 */
export interface ImportResult {
  success: boolean
  backupPaths: string[]
  importedFiles: string[]
}

function assertPassword(password: string): void {
  if (!password || !password.trim()) {
    throw new Error('备份密码不能为空')
  }
}

function deriveKey(password: string, salt: Buffer, iterations: number): Buffer {
  return crypto.pbkdf2Sync(password, salt, iterations, KEY_LENGTH, 'sha256')
}

function encryptPayload(payload: string, password: string): EncryptedBackupEnvelope {
  assertPassword(password)

  const salt = crypto.randomBytes(SALT_LENGTH)
  const iv = crypto.randomBytes(IV_LENGTH)
  const key = deriveKey(password, salt, PBKDF2_ITERATIONS)
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const createdAt = new Date().toISOString()

  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt,
    encryption: {
      algorithm: ENCRYPTION_ALGORITHM,
      kdf: KDF,
      iterations: PBKDF2_ITERATIONS,
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
    },
    payload: encrypted.toString('base64'),
  }
}

function decryptPayload(envelope: EncryptedBackupEnvelope, password: string): string {
  assertPassword(password)
  validateEnvelope(envelope)

  try {
    const salt = Buffer.from(envelope.encryption.salt, 'base64')
    const iv = Buffer.from(envelope.encryption.iv, 'base64')
    const tag = Buffer.from(envelope.encryption.tag, 'base64')
    const encrypted = Buffer.from(envelope.payload, 'base64')

    if (salt.length !== SALT_LENGTH || iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
      throw new Error('invalid encryption metadata')
    }

    const key = deriveKey(password, salt, envelope.encryption.iterations)
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])

    if (decrypted.byteLength > MAX_DECRYPTED_PAYLOAD_BYTES) {
      throw new Error('decrypted payload too large')
    }

    return decrypted.toString('utf8')
  } catch {
    throw new Error('解密失败：密码错误或备份文件损坏')
  }
}

function validateEnvelope(value: unknown): asserts value is EncryptedBackupEnvelope {
  if (!value || typeof value !== 'object') {
    throw new Error('不是有效的 AnyAI Tools 备份文件')
  }

  const envelope = value as EncryptedBackupEnvelope
  if (envelope.format !== BACKUP_FORMAT) {
    throw new Error('不是有效的 AnyAI Tools 备份文件')
  }
  if (envelope.formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new Error(`不支持的备份格式版本: ${envelope.formatVersion}`)
  }
  if (
    !envelope.encryption ||
    envelope.encryption.algorithm !== ENCRYPTION_ALGORITHM ||
    envelope.encryption.kdf !== KDF ||
    typeof envelope.encryption.iterations !== 'number' ||
    typeof envelope.encryption.salt !== 'string' ||
    typeof envelope.encryption.iv !== 'string' ||
    typeof envelope.encryption.tag !== 'string' ||
    typeof envelope.payload !== 'string'
  ) {
    throw new Error('备份文件加密信息不完整')
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function validateConfigContent(entry: ConfigEntry, content: unknown): void {
  if (!isPlainObject(content)) {
    throw new Error(`${entry.filename} 格式错误：内容必须是 JSON 对象`)
  }

  if (entry.kind === 'provider') {
    if (!Array.isArray(content.providers)) {
      throw new Error(`${entry.filename} 格式错误：缺少 providers 数组`)
    }
    if (content.presets !== undefined && !Array.isArray(content.presets)) {
      throw new Error(`${entry.filename} 格式错误：presets 必须是数组`)
    }
    return
  }

  if (!Array.isArray(content.servers)) {
    throw new Error(`${entry.filename} 格式错误：缺少 servers 数组`)
  }
  if (!isPlainObject(content.managedServerNames)) {
    throw new Error(`${entry.filename} 格式错误：缺少 managedServerNames 对象`)
  }
}

function readJsonFile(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch (error) {
    throw new Error(`读取 ${path.basename(filePath)} 失败: ${(error as Error).message}`)
  }
}

function getEntryByTool(tool: string): ConfigEntry | undefined {
  return CONFIG_ENTRIES.find((entry) => entry.tool === tool)
}

function formatTimestamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('')
}

function createUniqueBackupPath(targetDir: string): string {
  const baseName = `AnyAI-Tools-backup-${formatTimestamp()}`
  let candidate = path.join(targetDir, `${baseName}${BACKUP_FILE_EXTENSION}`)
  let suffix = 2

  while (fileExists(candidate)) {
    candidate = path.join(targetDir, `${baseName}-${suffix}${BACKUP_FILE_EXTENSION}`)
    suffix += 1
  }

  return candidate
}

function assertBackupFileSize(filePath: string): void {
  const stat = fs.statSync(filePath)
  if (stat.size > MAX_BACKUP_FILE_BYTES) {
    throw new Error('备份文件过大，可能不是有效的 AnyAI Tools 备份')
  }
}

function readEnvelope(filePath: string): EncryptedBackupEnvelope {
  assertBackupFileSize(filePath)

  const content = readJsonFile(filePath)
  validateEnvelope(content)
  return content
}

function validateBackupPayload(value: unknown): PreparedConfig[] {
  if (!isPlainObject(value)) {
    throw new Error('备份内容格式错误：payload 必须是对象')
  }

  const payload = value as Partial<BackupPayload>
  if (payload.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error(`不支持的备份内容版本: ${String(payload.schemaVersion)}`)
  }
  if (!isPlainObject(payload.configs)) {
    throw new Error('备份内容格式错误：缺少 configs 对象')
  }

  const prepared: PreparedConfig[] = []
  for (const [tool, rawConfig] of Object.entries(payload.configs)) {
    const entry = getEntryByTool(tool)
    if (!entry || !isPlainObject(rawConfig)) {
      continue
    }

    const filename = rawConfig.filename
    if (filename !== entry.filename) {
      throw new Error(`${tool} 配置文件名不匹配`)
    }

    const content = rawConfig.content
    validateConfigContent(entry, content)
    prepared.push({ entry, content })
  }

  if (prepared.length === 0) {
    throw new Error('备份内容中未找到可导入的配置')
  }

  return prepared
}

function readEncryptedBackup(sourcePath: string, password: string): PreparedConfig[] {
  const envelope = readEnvelope(sourcePath)
  const decrypted = decryptPayload(envelope, password)

  let payload: unknown
  try {
    payload = JSON.parse(decrypted)
  } catch (error) {
    throw new Error(`备份内容 JSON 损坏: ${(error as Error).message}`)
  }

  return validateBackupPayload(payload)
}

function getLegacyEntryFromFilePath(filePath: string): ConfigEntry | undefined {
  const basename = path.basename(filePath)
  return CONFIG_ENTRIES.find(
    (entry) => basename === entry.filename || basename === `${entry.filename}.bak`
  )
}

function readLegacySingleFile(filePath: string): PreparedConfig[] {
  const entry = getLegacyEntryFromFilePath(filePath)
  if (!entry) {
    throw new Error('不是有效的 AnyAI Tools 备份文件或旧配置文件')
  }

  const content = readJsonFile(filePath)
  validateConfigContent(entry, content)
  return [{ entry, content, sourcePath: filePath }]
}

function resolveLegacyConfigPath(sourceDir: string, filename: SupportedConfigFile): string | null {
  const jsonPath = path.join(sourceDir, filename)
  if (fileExists(jsonPath)) {
    return jsonPath
  }

  const bakPath = path.join(sourceDir, `${filename}.bak`)
  if (fileExists(bakPath)) {
    return bakPath
  }

  return null
}

function readLegacyDirectory(sourceDir: string): PreparedConfig[] {
  const prepared: PreparedConfig[] = []

  for (const entry of CONFIG_ENTRIES) {
    const sourcePath = resolveLegacyConfigPath(sourceDir, entry.filename)
    if (!sourcePath) {
      continue
    }

    const content = readJsonFile(sourcePath)
    validateConfigContent(entry, content)
    prepared.push({ entry, content, sourcePath })
  }

  if (prepared.length === 0) {
    const files = CONFIG_ENTRIES.map((entry) => entry.filename).join(' / ')
    throw new Error(`未找到配置文件 (${files})`)
  }

  return prepared
}

function getPreparedConfigs(sourcePath: string, password?: string): PreparedConfig[] {
  if (!fileExists(sourcePath)) {
    throw new Error(`路径不存在: ${sourcePath}`)
  }

  const stats = fs.statSync(sourcePath)
  if (stats.isDirectory()) {
    return readLegacyDirectory(sourcePath)
  }

  if (!stats.isFile()) {
    throw new Error(`不是有效的备份文件或目录: ${sourcePath}`)
  }

  if (getLegacyEntryFromFilePath(sourcePath)) {
    return readLegacySingleFile(sourcePath)
  }

  if (!password) {
    throw new Error('请输入备份密码')
  }

  return readEncryptedBackup(sourcePath, password)
}

/**
 * 验证导出操作（检查源文件是否存在）
 */
export function validateExport(): ExportValidation {
  const anyaitoolsDir = getAnyAIToolsDir()
  const foundFiles = CONFIG_ENTRIES.filter((entry) =>
    fileExists(path.join(anyaitoolsDir, entry.filename))
  ).map((entry) => entry.filename)

  if (foundFiles.length === 0) {
    const files = CONFIG_ENTRIES.map((entry) => entry.filename)
    return {
      valid: false,
      message: `未找到可导出的配置文件 (${files.join(' / ')})`,
      missingFiles: files,
      foundFiles: [],
    }
  }

  return {
    valid: true,
    foundFiles,
    missingFiles: CONFIG_ENTRIES.map((entry) => entry.filename).filter(
      (file) => !foundFiles.includes(file)
    ),
  }
}

/**
 * 验证导入路径（新加密备份文件或旧目录）
 */
export function validateImportSource(sourcePath: string, password?: string): ImportValidation {
  try {
    if (!fileExists(sourcePath)) {
      return {
        valid: false,
        message: `路径不存在: ${sourcePath}`,
        foundFiles: [],
      }
    }

    const stats = fs.statSync(sourcePath)
    if (stats.isDirectory()) {
      const prepared = readLegacyDirectory(sourcePath)
      return {
        valid: true,
        foundFiles: prepared.map(({ entry }) => entry.filename),
        encrypted: false,
        legacy: true,
        requiresPassword: false,
      }
    }

    if (!stats.isFile()) {
      return {
        valid: false,
        message: `不是有效的备份文件或目录: ${sourcePath}`,
        foundFiles: [],
      }
    }

    const legacyEntry = getLegacyEntryFromFilePath(sourcePath)
    if (legacyEntry) {
      const prepared = readLegacySingleFile(sourcePath)
      return {
        valid: true,
        foundFiles: prepared.map(({ entry }) => entry.filename),
        encrypted: false,
        legacy: true,
        requiresPassword: false,
      }
    }

    readEnvelope(sourcePath)
    if (!password) {
      return {
        valid: true,
        foundFiles: [],
        encrypted: true,
        legacy: false,
        requiresPassword: true,
      }
    }

    const prepared = readEncryptedBackup(sourcePath, password)
    return {
      valid: true,
      foundFiles: prepared.map(({ entry }) => entry.filename),
      encrypted: true,
      legacy: false,
      requiresPassword: false,
    }
  } catch (error) {
    return {
      valid: false,
      message: (error as Error).message,
      foundFiles: [],
    }
  }
}

/**
 * 兼容旧 API：验证导入目录。
 */
export function validateImportDir(sourceDir: string): ImportValidation {
  return validateImportSource(sourceDir)
}

/**
 * 导出配置到指定目录，生成单个加密备份文件。
 *
 * @param targetDir - 目标目录路径
 * @param password - 导出密码
 * @returns 导出结果
 */
export function exportConfig(targetDir: string, password: string): ExportResult {
  assertPassword(password)

  const validation = validateExport()
  if (!validation.valid) {
    throw new Error(validation.message)
  }

  ensureDir(targetDir)

  const anyaitoolsDir = getAnyAIToolsDir()
  const configs: BackupPayload['configs'] = {}
  const exportedFiles: string[] = []

  for (const entry of CONFIG_ENTRIES) {
    const src = path.join(anyaitoolsDir, entry.filename)
    if (!fileExists(src)) {
      continue
    }

    const content = readJsonFile(src)
    validateConfigContent(entry, content)
    configs[entry.tool] = {
      filename: entry.filename,
      content,
    }
    exportedFiles.push(entry.filename)
  }

  if (exportedFiles.length === 0) {
    throw new Error('未找到可导出的配置文件')
  }

  const payload: BackupPayload = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    createdAt: new Date().toISOString(),
    configs,
  }
  const envelope = encryptPayload(JSON.stringify(payload), password)
  const backupPath = createUniqueBackupPath(targetDir)

  fs.writeFileSync(backupPath, JSON.stringify(envelope, null, 2), { mode: 0o600 })

  return {
    success: true,
    targetDir,
    backupPath,
    exportedFiles,
  }
}

/**
 * 从加密备份文件或旧目录导入配置。
 *
 * @param sourcePath - 源备份文件或旧目录
 * @param password - 备份密码；旧目录格式不需要
 * @returns 导入结果（包含备份路径）
 */
export function importConfig(sourcePath: string, password?: string): ImportResult {
  const preparedConfigs = getPreparedConfigs(sourcePath, password)
  const anyaitoolsDir = getAnyAIToolsDir()
  const backupPaths: string[] = []
  const importedFiles: string[] = []
  const createdPaths = new Set<string>()

  ensureDir(anyaitoolsDir)

  try {
    for (const { entry, content } of preparedConfigs) {
      const targetPath = path.join(anyaitoolsDir, entry.filename)

      if (fileExists(targetPath)) {
        backupPaths.push(backupConfig(targetPath))
      } else {
        createdPaths.add(targetPath)
      }

      writeJSON(targetPath, content)
      importedFiles.push(entry.filename)
    }

    return {
      success: true,
      backupPaths,
      importedFiles,
    }
  } catch (error) {
    for (const backupPath of backupPaths) {
      const originalPath = backupPath.replace(/\.backup\.\d+$/, '')
      if (fileExists(backupPath)) {
        fs.copyFileSync(backupPath, originalPath)
      }
    }

    for (const createdPath of createdPaths) {
      fs.rmSync(createdPath, { force: true })
    }

    throw new Error(`导入失败，已恢复备份: ${(error as Error).message}`)
  }
}
