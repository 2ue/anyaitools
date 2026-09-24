type RpcResponse =
  | { ok: true; result: unknown }
  | { ok: false; error: string }

function unsupported(feature: string): never {
  throw new Error(`${feature} 仅支持 Desktop，Web 版请使用 CLI 或浏览器对应操作`)
}

async function rpc(method: string, args: unknown[] = []): Promise<any> {
  const queryToken = new URLSearchParams(window.location.search).get('token')
  const token = queryToken || window.localStorage.getItem('anyaitools.web.token')
  if (queryToken) window.localStorage.setItem('anyaitools.web.token', queryToken)
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token) headers['X-AnyAI-Tools-Token'] = token
  const response = await fetch('/api/v1/rpc', {
    method: 'POST',
    headers,
    body: JSON.stringify({ method, args }),
  })
  const payload = (await response.json()) as RpcResponse
  if (!response.ok || !payload.ok) {
    throw new Error(payload.ok ? `请求失败 (${response.status})` : payload.error)
  }
  return payload.result
}

function createGroup(
  prefix: string,
  overrides: Record<string, string | ((...args: any[]) => Promise<any>)> = {}
): Record<string, (...args: any[]) => Promise<any>> {
  return new Proxy(
    {},
    {
      get: (_target, property: string) => {
        const override = overrides[property]
        if (typeof override === 'function') return override
        const method =
          override ||
          `${prefix}:${property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`
        return (...args: any[]) => rpc(method, args)
      },
    }
  )
}

const system = createGroup('system', {
  openFolder: async () => ({ success: false, message: 'Web 版没有服务器文件夹打开能力' }),
  openUrl: async (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
    return { success: true }
  },
  getAppVersion: 'system:get-app-version',
})

const update = {
  supported: false,
  check: async () => unsupported('应用更新'),
  download: async () => unsupported('应用更新'),
  install: async () => unsupported('应用更新'),
  backgroundCheck: async () => unsupported('应用更新'),
  onEvent: () => () => {},
}

const importExport = {
  selectFolder: async () => '__web_server__',
  selectImportSource: async () => unsupported('备份导入'),
  exportConfig: (targetDir: string, password: string) =>
    rpc('importexport:export', [targetDir, password]),
  importConfig: async () => unsupported('备份导入'),
  validateImportDir: async () => unsupported('备份导入'),
}

const electronAPI = {
  codex: createGroup('codex'),
  claude: createGroup('claude'),
  gemini: createGroup('gemini'),
  opencode: createGroup('opencode'),
  openclaw: createGroup('openclaw'),
  grok: createGroup('grok'),
  config: createGroup('', {
    readConfigFiles: 'read-config-files',
    writeConfigFiles: 'write-config-files',
    readAnyAIToolsConfigFiles: 'read-anyaitools-config-files',
    writeAnyAIToolsConfigFiles: 'write-anyaitools-config-files',
    migrate: 'migrate-config',
  }),
  models: createGroup('models'),
  system,
  update,
  sync: createGroup('sync', {
    saveSyncConfig: 'sync:save-config',
    getSyncConfig: 'sync:get-config',
    testConnection: 'sync:test-connection',
    uploadToCloud: 'sync:upload-to-cloud',
    downloadFromCloud: 'sync:download-from-cloud',
    mergeSync: 'sync:merge-sync',
  }),
  importExport,
  clean: createGroup('clean'),
  mcp: createGroup('mcp'),
}

window.electronAPI = electronAPI
