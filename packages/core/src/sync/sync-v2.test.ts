import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { __setTestPaths, getAnyAIToolsDir, getGrokConfigPath } from '../paths.js'
import { downloadFromCloud, mergeSync, uploadToCloud } from './sync-v2.js'
import { downloadFromWebDAV, existsOnWebDAV, uploadToWebDAV } from './webdav-client.js'

vi.mock('./webdav-client.js', () => ({
  uploadToWebDAV: vi.fn(async () => {}),
  downloadFromWebDAV: vi.fn(async () => ''),
  existsOnWebDAV: vi.fn(async () => false),
}))

describe('sync-v2', () => {
  let testDir: string

  beforeEach(() => {
    testDir = path.join(
      os.tmpdir(),
      `anyaitools-sync-v2-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )

    __setTestPaths({
      anyaitools: path.join(testDir, '.anyaitools'),
      codex: path.join(testDir, '.codex'),
      claude: path.join(testDir, '.claude'),
      opencode: path.join(testDir, '.config', 'opencode'),
      openclaw: path.join(testDir, '.openclaw'),
      grok: path.join(testDir, '.grok'),
    })

    fs.rmSync(testDir, { recursive: true, force: true })
    vi.clearAllMocks()
    vi.mocked(uploadToWebDAV).mockReset().mockResolvedValue()
    vi.mocked(downloadFromWebDAV).mockReset().mockResolvedValue('')
    vi.mocked(existsOnWebDAV).mockReset().mockResolvedValue(false)
  })

  it('should skip missing files and upload existing openclaw config only', async () => {
    const anyaitoolsDir = getAnyAIToolsDir()
    fs.mkdirSync(anyaitoolsDir, { recursive: true })
    fs.writeFileSync(
      path.join(anyaitoolsDir, 'openclaw.json'),
      JSON.stringify(
        {
          currentProviderId: 'openclaw-1',
          providers: [
            {
              id: 'openclaw-1',
              name: 'OKMCode',
              baseUrl: 'https://okmcode.com/v1',
              apiKey: 'sk-sync-openclaw',
              createdAt: Date.now(),
              lastModified: Date.now(),
            },
          ],
          presets: [],
        },
        null,
        2
      ),
      'utf-8'
    )

    await uploadToCloud(
      {
        webdavUrl: 'https://dav.example.com',
        username: 'demo',
        password: 'demo',
        remoteDir: '/',
      },
      'sync-password'
    )

    const mock = vi.mocked(uploadToWebDAV)
    expect(mock).toHaveBeenCalledTimes(1)
    expect(mock.mock.calls[0][1]).toBe('.anyaitools/openclaw.json')
  })

  it('should throw when no local sync file exists', async () => {
    await expect(
      uploadToCloud(
        {
          webdavUrl: 'https://dav.example.com',
          username: 'demo',
          password: 'demo',
          remoteDir: '/',
        },
        'sync-password'
      )
    ).rejects.toThrow('本地未找到可上传的配置文件')
  })

  it('should upload a custom Grok provider with an empty inline API key', async () => {
    const anyaitoolsDir = getAnyAIToolsDir()
    fs.mkdirSync(anyaitoolsDir, { recursive: true })
    fs.writeFileSync(
      path.join(anyaitoolsDir, 'grok.json'),
      JSON.stringify(
        {
          currentProviderId: 'grok-1',
          providers: [
            {
              id: 'grok-1',
              name: 'Custom Grok',
              baseUrl: 'https://gateway.example.test/v1',
              apiKey: '',
              model: 'custom-model',
              apiBackend: 'chat_completions',
              supportsBackendSearch: false,
              createdAt: Date.now(),
              lastModified: Date.now(),
            },
          ],
          presets: [],
        },
        null,
        2
      ),
      'utf-8'
    )

    await uploadToCloud(
      {
        webdavUrl: 'https://dav.example.com',
        username: 'demo',
        password: 'demo',
      },
      'sync-password'
    )

    const mock = vi.mocked(uploadToWebDAV)
    expect(mock).toHaveBeenCalledTimes(1)
    expect(mock.mock.calls[0][1]).toBe('.anyaitools/grok.json')
    const uploaded = JSON.parse(mock.mock.calls[0][2])
    expect(uploaded.providers[0]).toMatchObject({
      apiKey: '',
      model: 'custom-model',
      apiBackend: 'chat_completions',
      supportsBackendSearch: false,
    })
  })

  it('removes a newly created internal file when download cannot apply Grok config', async () => {
    const provider = {
      id: 'grok-download',
      name: 'Downloaded Grok',
      baseUrl: 'https://gateway.example.test/v1',
      apiKey: '',
      model: 'download-model',
      apiBackend: 'chat_completions',
      supportsBackendSearch: false,
      createdAt: 1,
      lastModified: 1,
    }
    const remoteConfig = JSON.stringify({
      currentProviderId: provider.id,
      providers: [provider],
      presets: [],
    })
    vi.mocked(existsOnWebDAV).mockImplementation(
      async (_config, remotePath) => remotePath === '.anyaitools/grok.json'
    )
    vi.mocked(downloadFromWebDAV).mockResolvedValue(remoteConfig)

    const grokConfigPath = getGrokConfigPath()
    fs.mkdirSync(path.dirname(grokConfigPath), { recursive: true })
    const invalidGrokConfig = 'models = "unterminated\n'
    fs.writeFileSync(grokConfigPath, invalidGrokConfig, 'utf-8')

    await expect(
      downloadFromCloud(
        { webdavUrl: 'https://dav.example.com', username: 'demo', password: 'demo' },
        'sync-password'
      )
    ).rejects.toThrow('覆盖配置失败，已恢复备份')

    expect(fs.existsSync(path.join(getAnyAIToolsDir(), 'grok.json'))).toBe(false)
    expect(fs.readFileSync(grokConfigPath, 'utf-8')).toBe(invalidGrokConfig)
  })

  it('restores internal and external Grok configs when merge upload fails', async () => {
    const localProvider = {
      id: 'grok-local',
      name: 'Local Grok',
      baseUrl: 'https://local.example.test/v1',
      apiKey: '',
      model: 'local-model',
      apiBackend: 'responses',
      supportsBackendSearch: true,
      createdAt: 1,
      lastModified: 1,
    }
    const remoteProvider = {
      ...localProvider,
      id: 'grok-remote',
      name: 'Remote Grok',
      baseUrl: 'https://remote.example.test/v1',
      model: 'remote-model',
    }
    const anyaitoolsDir = getAnyAIToolsDir()
    fs.mkdirSync(anyaitoolsDir, { recursive: true })
    const localConfigPath = path.join(anyaitoolsDir, 'grok.json')
    const originalLocalConfig = JSON.stringify(
      {
        currentProviderId: localProvider.id,
        providers: [localProvider],
        presets: [],
      },
      null,
      2
    )
    fs.writeFileSync(localConfigPath, originalLocalConfig, 'utf-8')

    const grokConfigPath = getGrokConfigPath()
    fs.mkdirSync(path.dirname(grokConfigPath), { recursive: true })
    const originalGrokConfig = [
      '[models]',
      'default = "manual"',
      '',
      '[model.manual]',
      'model = "manual-model"',
      'base_url = "https://manual.example.test/v1"',
      '',
      '[cli]',
      'installer = "npm"',
      '',
    ].join('\n')
    fs.writeFileSync(grokConfigPath, originalGrokConfig, { mode: 0o600 })

    const remoteConfig = JSON.stringify({ providers: [remoteProvider], presets: [] })
    vi.mocked(existsOnWebDAV).mockImplementation(
      async (_config, remotePath) => remotePath === '.anyaitools/grok.json'
    )
    vi.mocked(downloadFromWebDAV).mockResolvedValue(remoteConfig)
    vi.mocked(uploadToWebDAV).mockRejectedValue(new Error('simulated upload failure'))

    await expect(
      mergeSync(
        { webdavUrl: 'https://dav.example.com', username: 'demo', password: 'demo' },
        'sync-password'
      )
    ).rejects.toThrow('合并配置失败，已恢复备份')

    expect(fs.readFileSync(localConfigPath, 'utf-8')).toBe(originalLocalConfig)
    expect(fs.readFileSync(grokConfigPath, 'utf-8')).toBe(originalGrokConfig)
  })
})
