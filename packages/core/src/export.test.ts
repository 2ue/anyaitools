import { describe, it, expect, beforeEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { __setTestPaths, getAnyAIToolsDir } from './paths.js'
import {
  validateExport,
  exportConfig,
  validateImportSource,
  validateImportDir,
  importConfig,
} from './export.js'

function createTestDir(): string {
  return path.join(
    os.tmpdir(),
    `anyaitools-export-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
}

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

function providerConfig(id: string, apiKey = `sk-${id}`) {
  return {
    currentProviderId: id,
    providers: [
      {
        id,
        name: id,
        baseUrl: 'https://api.example.test/v1',
        apiKey,
        createdAt: 1,
        lastModified: 1,
      },
    ],
    presets: [],
  }
}

describe('export/import', () => {
  let testDir: string

  beforeEach(() => {
    testDir = createTestDir()

    __setTestPaths({
      anyaitools: path.join(testDir, '.anyaitools'),
      codex: path.join(testDir, '.codex'),
      claude: path.join(testDir, '.claude'),
      opencode: path.join(testDir, '.config', 'opencode'),
      openclaw: path.join(testDir, '.openclaw'),
      grok: path.join(testDir, '.grok'),
    })

    fs.rmSync(testDir, { recursive: true, force: true })
  })

  it('exports an encrypted backup file and imports it directly', () => {
    const anyaitoolsDir = getAnyAIToolsDir()
    writeJson(path.join(anyaitoolsDir, 'codex.json'), providerConfig('codex-current'))
    writeJson(path.join(anyaitoolsDir, 'gemini.json'), providerConfig('gemini-current'))
    writeJson(path.join(anyaitoolsDir, 'mcp.json'), {
      servers: [
        {
          id: 'mcp-1',
          name: 'secret-server',
          command: 'npx',
          args: ['-y', 'tool', '--token', 'mcp-secret'],
          env: { TOKEN: 'env-secret' },
          createdAt: 1,
          lastModified: 1,
          enabledApps: ['claude'],
        },
      ],
      managedServerNames: { claude: ['secret-server'], codex: [], gemini: [] },
    })

    const validation = validateExport()
    expect(validation.valid).toBe(true)
    expect(validation.foundFiles).toEqual(['codex.json', 'gemini.json', 'mcp.json'])

    const targetDir = path.join(testDir, 'backup-target')
    const exported = exportConfig(targetDir, 'backup-password')
    expect(exported.success).toBe(true)
    expect(exported.backupPath.endsWith('.anyaitools-backup')).toBe(true)
    expect(exported.exportedFiles).toEqual(['codex.json', 'gemini.json', 'mcp.json'])

    const encryptedContent = fs.readFileSync(exported.backupPath, 'utf-8')
    expect(encryptedContent).not.toContain('sk-codex-current')
    expect(encryptedContent).not.toContain('mcp-secret')
    expect(encryptedContent).not.toContain('env-secret')

    fs.rmSync(anyaitoolsDir, { recursive: true, force: true })

    const importValidation = validateImportSource(exported.backupPath, 'backup-password')
    expect(importValidation.valid).toBe(true)
    expect(importValidation.encrypted).toBe(true)
    expect(importValidation.foundFiles).toEqual(['codex.json', 'gemini.json', 'mcp.json'])

    const imported = importConfig(exported.backupPath, 'backup-password')
    expect(imported.success).toBe(true)
    expect(imported.importedFiles).toEqual(['codex.json', 'gemini.json', 'mcp.json'])

    const restoredCodex = JSON.parse(
      fs.readFileSync(path.join(anyaitoolsDir, 'codex.json'), 'utf-8')
    )
    expect(restoredCodex.currentProviderId).toBe('codex-current')

    const restoredMcp = JSON.parse(fs.readFileSync(path.join(anyaitoolsDir, 'mcp.json'), 'utf-8'))
    expect(restoredMcp.servers[0].args).toContain('mcp-secret')
  })

  it('does not import encrypted backups with a wrong password', () => {
    const anyaitoolsDir = getAnyAIToolsDir()
    writeJson(path.join(anyaitoolsDir, 'grok.json'), providerConfig('grok-current', 'sk-grok'))

    const exported = exportConfig(path.join(testDir, 'backup-target'), 'correct-password')
    fs.rmSync(anyaitoolsDir, { recursive: true, force: true })

    const validation = validateImportSource(exported.backupPath, 'wrong-password')
    expect(validation.valid).toBe(false)
    expect(validation.message).toContain('解密失败')

    expect(() => importConfig(exported.backupPath, 'wrong-password')).toThrow('解密失败')
    expect(fs.existsSync(path.join(anyaitoolsDir, 'grok.json'))).toBe(false)
  })

  it('keeps legacy directory import compatibility for loose json files', () => {
    const sourceDir = path.join(testDir, 'legacy-source')
    writeJson(path.join(sourceDir, 'openclaw.json'), providerConfig('openclaw-current'))

    const anyaitoolsDir = getAnyAIToolsDir()
    writeJson(path.join(anyaitoolsDir, 'openclaw.json'), providerConfig('legacy'))

    const validation = validateImportDir(sourceDir)
    expect(validation.valid).toBe(true)
    expect(validation.legacy).toBe(true)
    expect(validation.foundFiles).toEqual(['openclaw.json'])

    const result = importConfig(sourceDir)
    expect(result.importedFiles).toEqual(['openclaw.json'])
    expect(result.backupPaths).toHaveLength(1)

    const imported = JSON.parse(fs.readFileSync(path.join(anyaitoolsDir, 'openclaw.json'), 'utf-8'))
    expect(imported.currentProviderId).toBe('openclaw-current')
  })

  it('treats legacy json.bak files as importable fallback files', () => {
    const sourceDir = path.join(testDir, 'legacy-bak-source')
    writeJson(path.join(sourceDir, 'grok.json.bak'), providerConfig('grok-bak-current'))

    const validation = validateImportSource(sourceDir)
    expect(validation.valid).toBe(true)
    expect(validation.legacy).toBe(true)
    expect(validation.foundFiles).toEqual(['grok.json'])

    const result = importConfig(sourceDir)
    expect(result.importedFiles).toEqual(['grok.json'])

    const imported = JSON.parse(
      fs.readFileSync(path.join(getAnyAIToolsDir(), 'grok.json'), 'utf-8')
    )
    expect(imported.currentProviderId).toBe('grok-bak-current')
  })
})
