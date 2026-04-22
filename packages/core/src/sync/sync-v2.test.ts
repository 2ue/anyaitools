import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { __setTestPaths, getAnyAIToolsDir } from '../paths.js'
import { uploadToCloud } from './sync-v2.js'
import { uploadToWebDAV } from './webdav-client.js'

vi.mock('./webdav-client.js', () => ({
  uploadToWebDAV: vi.fn(async () => {}),
  downloadFromWebDAV: vi.fn(async () => ''),
  existsOnWebDAV: vi.fn(async () => false),
}))

describe('sync-v2 uploadToCloud', () => {
  beforeEach(() => {
    const testDir = path.join(
      os.tmpdir(),
      `anyaitools-sync-v2-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )

    __setTestPaths({
      anyaitools: path.join(testDir, '.anyaitools'),
      codex: path.join(testDir, '.codex'),
      claude: path.join(testDir, '.claude'),
      opencode: path.join(testDir, '.config', 'opencode'),
      openclaw: path.join(testDir, '.openclaw'),
    })

    fs.rmSync(path.join(testDir, '.anyaitools'), { recursive: true, force: true })
    vi.clearAllMocks()
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
})
