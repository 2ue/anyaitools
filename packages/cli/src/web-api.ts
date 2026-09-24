import fs from 'node:fs'
import path from 'node:path'
import {
  VERSION,
  addMCPRegistrySource,
  addMCPServer,
  analyzeClaudeJson,
  clearModelCatalogCache,
  clearProjectHistory,
  cleanClaudeJson,
  cloneMCPServer,
  createClaudeManager,
  createCodexManager,
  createGeminiManager,
  createGrokManager,
  createMCPManager,
  createOpenClawManager,
  createOpenCodeManager,
  deleteCacheItem,
  deleteHistoryEntry,
  deleteProjectHistory,
  downloadFromCloud,
  editMCPServer,
  exportConfig,
  exportMCPJson,
  fetchMCPRegistry,
  fetchModelCatalog,
  getAnyAIToolsDir,
  getClaudeConfigPath,
  getClaudeJsonPath,
  getCodexAuthPath,
  getCodexConfigPath,
  getGeminiEnvPath,
  getGeminiSettingsPath,
  getGrokConfigPath,
  getMCPConfigPath,
  getOpenClawConfigPath,
  getOpenClawModelsPath,
  getOpenCodeConfigPath,
  getProjectDetails,
  getCacheDetails,
  getProjectHistory,
  getSyncConfig,
  importConfig,
  importMCPJson,
  listMCPToolCapabilities,
  loadMCPConfig,
  loadMCPRegistrySources,
  migrateConfig,
  parseMCPJson,
  refreshMCPRegistrySource,
  removeMCPRegistrySource,
  saveSyncConfig,
  searchMCPRegistry,
  setCodexPreserveProviderName,
  testWebDAVConnection,
  toggleMCPForApp,
  uploadToCloud,
  validateImportSource,
  validateMCPJson,
  mergeSync,
  CleanPresets,
} from '@anyaitools/core'
import type {
  AddProviderInput,
  AddPresetInput,
  AppType,
  EditPresetInput,
  EditProviderInput,
  MCPExportOptions,
  MCPImportOptions,
  MCPRegistryQuery,
  MCPRegistrySourceInput,
  MCPServerInput,
  ModelCatalogRequest,
  SyncConfig,
} from '@anyaitools/core'

type EditableConfigFile = {
  name: string
  path: string
  content: string
  language: 'json' | 'toml' | 'env'
}

const managerFactories: Record<string, () => any> = {
  codex: createCodexManager,
  claude: createClaudeManager,
  gemini: createGeminiManager,
  opencode: createOpenCodeManager,
  openclaw: createOpenClawManager,
  grok: createGrokManager,
}

const managerOperations = new Set([
  'add-provider',
  'list-providers',
  'get-provider',
  'switch-provider',
  'edit-provider',
  'remove-provider',
  'clone-provider',
  'get-current',
  'find-by-name',
  'add-preset',
  'list-presets',
  'edit-preset',
  'remove-preset',
])

const toolConfigPaths = [
  getClaudeConfigPath(),
  getClaudeJsonPath(),
  getCodexConfigPath(),
  getCodexAuthPath(),
  getGeminiSettingsPath(),
  getGeminiEnvPath(),
  getOpenCodeConfigPath(),
  getOpenClawConfigPath(),
  getOpenClawModelsPath(),
  getGrokConfigPath(),
  getMCPConfigPath(),
]

function isInside(target: string, root: string): boolean {
  const resolvedTarget = path.resolve(target)
  const resolvedRoot = path.resolve(root)
  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)
}

function assertWritableConfigPath(filePath: string, anyAIToolsOnly = false): void {
  const allowed = anyAIToolsOnly
    ? isInside(filePath, getAnyAIToolsDir())
    : toolConfigPaths.some((candidate) => path.resolve(candidate) === path.resolve(filePath)) ||
      isInside(filePath, getAnyAIToolsDir())
  if (!allowed) throw new Error(`不允许写入配置路径: ${filePath}`)
}

function writePrivateFile(filePath: string, content: string): void {
  const tempPath = `${filePath}.tmp`
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(tempPath, content, { encoding: 'utf8', mode: 0o600 })
  fs.chmodSync(tempPath, 0o600)
  fs.renameSync(tempPath, filePath)
  fs.chmodSync(filePath, 0o600)
}

function writeConfigFiles(
  files: EditableConfigFile[],
  anyAIToolsOnly = false
): { success: boolean } {
  const existing = files
    .filter((file) => {
      assertWritableConfigPath(file.path, anyAIToolsOnly)
      return fs.existsSync(file.path)
    })
    .map((file) => ({ path: file.path, content: fs.readFileSync(file.path, 'utf8') }))

  for (const file of files) {
    if (fs.existsSync(file.path)) fs.copyFileSync(file.path, `${file.path}.bak`)
  }

  try {
    for (const file of files) writePrivateFile(file.path, file.content)
    return { success: true }
  } catch (error) {
    for (const file of existing) writePrivateFile(file.path, file.content)
    throw error
  }
}

function fileEntry(
  name: string,
  filePath: string,
  language: EditableConfigFile['language'],
  fallback: string
): EditableConfigFile {
  return {
    name,
    path: filePath,
    language,
    content: fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : fallback,
  }
}

function readConfigFiles(
  tool: 'codex' | 'claude' | 'mcp' | 'gemini' | 'opencode' | 'openclaw' | 'grok'
): EditableConfigFile[] {
  if (tool === 'claude') {
    return [
      fileEntry(
        'settings.json',
        getClaudeConfigPath(),
        'json',
        '# 配置文件不存在\n# 请先添加 Claude 服务商\n'
      ),
    ]
  }
  if (tool === 'mcp') {
    return [
      fileEntry(
        'mcp.json',
        getMCPConfigPath(),
        'json',
        '# MCP 配置文件不存在\n# 请先添加 MCP 服务器\n'
      ),
    ]
  }
  if (tool === 'codex') {
    return [
      fileEntry('config.toml', getCodexConfigPath(), 'toml', '# Codex 配置文件不存在\n'),
      fileEntry('auth.json', getCodexAuthPath(), 'json', '{\n  "注意": "配置文件不存在"\n}\n'),
    ]
  }
  if (tool === 'gemini') {
    return [
      fileEntry('settings.json', getGeminiSettingsPath(), 'json', '# Gemini 配置文件不存在\n'),
      fileEntry('env', getGeminiEnvPath(), 'env', '# Gemini 环境变量文件不存在\n'),
    ]
  }
  if (tool === 'opencode') {
    return [
      fileEntry('opencode.json', getOpenCodeConfigPath(), 'json', '# OpenCode 配置文件不存在\n'),
    ]
  }
  if (tool === 'openclaw') {
    return [
      fileEntry('openclaw.json', getOpenClawConfigPath(), 'json', '# OpenClaw 配置文件不存在\n'),
      fileEntry('models.json', getOpenClawModelsPath(), 'json', '# OpenClaw models 文件不存在\n'),
    ]
  }
  return [fileEntry('config.toml', getGrokConfigPath(), 'toml', '# Grok 配置文件不存在\n')]
}

function readAnyAIToolsConfigFiles(): EditableConfigFile[] {
  const names = ['codex', 'claude', 'gemini', 'opencode', 'openclaw', 'grok', 'mcp']
  return names.map((name) => {
    const filePath = path.join(getAnyAIToolsDir(), `${name}.json`)
    return fileEntry(name === 'mcp' ? 'mcp.json' : `${name}.json`, filePath, 'json', '{}\n')
  })
}

function handleManagerMethod(tool: string, operation: string, args: unknown[]): unknown {
  const factory = managerFactories[tool]
  if (!factory) return undefined
  const manager = factory()
  const input = args[0]
  switch (operation) {
    case 'add-provider':
      return manager.add(input as AddProviderInput)
    case 'list-providers':
      return manager.list()
    case 'get-provider':
      return manager.get(String(args[0]))
    case 'switch-provider':
      return manager.switch(String(args[0]))
    case 'edit-provider':
      return manager.edit(String(args[0]), args[1] as EditProviderInput)
    case 'remove-provider':
      return manager.remove(String(args[0]))
    case 'clone-provider':
      return manager.clone(String(args[0]), String(args[1]))
    case 'get-current':
      return manager.getCurrent()
    case 'find-by-name':
      return manager.findByName(String(args[0]))
    case 'add-preset':
      return manager.addPreset(input as AddPresetInput)
    case 'list-presets':
      return manager.listPresets()
    case 'edit-preset':
      return manager.editPreset(String(args[0]), args[1] as EditPresetInput)
    case 'remove-preset':
      return manager.removePreset(String(args[0]))
    default:
      return undefined
  }
}

function handleMCPMethod(operation: string, args: unknown[]): unknown {
  switch (operation) {
    case 'list-servers':
      return loadMCPConfig().servers
    case 'list-capabilities':
      return listMCPToolCapabilities()
    case 'validate-json':
      return validateMCPJson(args[0] as string | object)
    case 'parse-json':
      return parseMCPJson(args[0] as string | object)
    case 'import-json':
      return importMCPJson(args[0] as string | object, args[1] as MCPImportOptions | undefined)
    case 'export-json':
      return exportMCPJson(args[0] as MCPExportOptions | undefined)
    case 'fetch-registry':
      return fetchMCPRegistry(String(args[0]))
    case 'list-registry-sources':
      return loadMCPRegistrySources()
    case 'add-registry-source':
      return addMCPRegistrySource(args[0] as MCPRegistrySourceInput)
    case 'remove-registry-source':
      removeMCPRegistrySource(String(args[0]))
      return { success: true }
    case 'refresh-registry-source':
      return refreshMCPRegistrySource(String(args[0]))
    case 'search-registry':
      return searchMCPRegistry(args[0] as MCPRegistryQuery | undefined)
    case 'toggle-app':
      toggleMCPForApp(String(args[0]), args[1] as AppType, Boolean(args[2]))
      return { success: true }
    case 'get-app-status':
      return getMCPConfigStatus(String(args[0]))
    case 'add-server':
      return createMCPManager().add(args[0] as AddProviderInput)
    case 'add-canonical-server':
      return addMCPServer(args[0] as MCPServerInput)
    case 'edit-canonical-server':
      return editMCPServer(String(args[0]), args[1] as Partial<MCPServerInput>)
    case 'get-server':
      return createMCPManager().get(String(args[0]))
    case 'edit-server':
      return createMCPManager().edit(String(args[0]), args[1] as EditProviderInput)
    case 'clone-server':
      return cloneMCPServer(String(args[0]), String(args[1]))
    case 'remove-server':
      createMCPManager().remove(String(args[0]))
      return { success: true }
    default:
      return undefined
  }
}

function getMCPConfigStatus(id: string): Record<string, boolean> {
  const server = loadMCPConfig().servers.find((item) => item.id === id)
  if (!server) throw new Error(`MCP 服务器不存在: ${id}`)
  return {
    claude: server.enabledTools.claude === true,
    codex: server.enabledTools.codex === true,
    gemini: server.enabledTools.gemini === true,
    opencode: server.enabledTools.opencode === true,
    openclaw: server.enabledTools.openclaw === true,
    grok: server.enabledTools.grok === true,
  }
}

function exportTargetDir(requested: string): string {
  if (requested === '__web_server__') {
    const target = path.join(getAnyAIToolsDir(), 'backups')
    fs.mkdirSync(target, { recursive: true })
    return target
  }
  if (!isInside(requested, getAnyAIToolsDir())) {
    throw new Error('Web 版只能把备份导出到 AnyAI Tools 配置目录')
  }
  return requested
}

export async function dispatchWebMethod(method: string, args: unknown[] = []): Promise<unknown> {
  const [namespace, operation] = method.includes(':') ? method.split(':', 2) : ['', method]
  if (namespace && managerFactories[namespace] && managerOperations.has(operation)) {
    return await handleManagerMethod(namespace, operation, args)
  }
  if (namespace === 'mcp') {
    return await handleMCPMethod(operation, args)
  }
  switch (method) {
    case 'read-config-files':
      return readConfigFiles(args[0] as Parameters<typeof readConfigFiles>[0])
    case 'write-config-files':
      return writeConfigFiles(args[0] as EditableConfigFile[])
    case 'read-anyaitools-config-files':
      return readAnyAIToolsConfigFiles()
    case 'write-anyaitools-config-files':
      return writeConfigFiles(args[0] as EditableConfigFile[], true)
    case 'migrate-config':
      return migrateConfig()
    case 'models:fetch-catalog':
      return fetchModelCatalog(args[0] as ModelCatalogRequest)
    case 'models:clear-catalog-cache':
      clearModelCatalogCache(args[0] as string | undefined)
      return { success: true }
    case 'codex:get-settings':
      return (await import('@anyaitools/core')).getCodexSettings()
    case 'codex:set-preserve-provider-name':
      return setCodexPreserveProviderName(Boolean(args[0]))
    case 'system:get-app-version':
      return VERSION
    case 'sync:save-config':
      saveSyncConfig(args[0] as SyncConfig)
      return { success: true }
    case 'sync:get-config':
      return getSyncConfig()
    case 'sync:test-connection':
      return testWebDAVConnection(args[0] as SyncConfig)
    case 'sync:upload-to-cloud':
      await uploadToCloud(args[0] as SyncConfig, String(args[1]))
      return { success: true }
    case 'sync:download-from-cloud':
      return downloadFromCloud(args[0] as SyncConfig, String(args[1]))
    case 'sync:merge-sync':
      return mergeSync(args[0] as SyncConfig, String(args[1]))
    case 'importexport:export':
      return exportConfig(exportTargetDir(String(args[0])), String(args[1]))
    case 'importexport:validate':
      return validateImportSource(String(args[0]), args[1] as string | undefined)
    case 'importexport:import':
      return importConfig(String(args[0]), args[1] as string | undefined)
    case 'open-folder':
      return { success: false, message: 'Web 版不能打开服务器文件夹' }
    case 'open-url':
      return { success: true }
    case 'clean:analyze':
      return analyzeClaudeJson()
    case 'clean:get-projects':
      return getProjectDetails()
    case 'clean:get-caches':
      return getCacheDetails()
    case 'clean:delete-project':
      deleteProjectHistory(String(args[0]))
      return undefined
    case 'clean:delete-cache':
      deleteCacheItem(String(args[0]))
      return undefined
    case 'clean:execute-preset':
      return cleanClaudeJson(CleanPresets[String(args[0]) as keyof typeof CleanPresets]())
    case 'clean:get-project-history':
      return getProjectHistory(String(args[0]))
    case 'clean:delete-history-entry':
      deleteHistoryEntry(String(args[0]), Number(args[1]))
      return undefined
    case 'clean:clear-project-history':
      clearProjectHistory(String(args[0]))
      return undefined
    default:
      throw new Error(`Web API 不支持的方法: ${method}`)
  }
}

export function getWebInfo(): { version: string; configDir: string } {
  return { version: VERSION, configDir: getAnyAIToolsDir() }
}
