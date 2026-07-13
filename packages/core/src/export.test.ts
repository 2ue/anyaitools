import { describe, it, expect, beforeEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { __setTestPaths, getAnyAIToolsDir } from './paths.js'
import { validateExport, exportConfig, validateImportDir, importConfig } from './export.js'

describe('export/import', () => {
  beforeEach(() => {
    const testDir = path.join(
      os.tmpdir(),
      `anyaitools-export-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )

    __setTestPaths({
      anyaitools: path.join(testDir, '.anyaitools'),
      codex: path.join(testDir, '.codex'),
      claude: path.join(testDir, '.claude'),
      opencode: path.join(testDir, '.config', 'opencode'),
      openclaw: path.join(testDir, '.openclaw'),
    })

    fs.rmSync(path.join(testDir, '.anyaitools'), { recursive: true, force: true })
  })

  it('should allow export when only openclaw.json exists', () => {
    const anyaitoolsDir = getAnyAIToolsDir()
    fs.mkdirSync(anyaitoolsDir, { recursive: true })
    fs.writeFileSync(
      path.join(anyaitoolsDir, 'openclaw.json'),
      JSON.stringify({ providers: [], presets: [] }, null, 2),
      'utf-8'
    )

    const validation = validateExport()
    expect(validation.valid).toBe(true)
    expect(validation.foundFiles).toEqual(['openclaw.json'])

    const targetDir = path.join(os.tmpdir(), `anyaitools-export-target-${Date.now()}`)
    const result = exportConfig(targetDir)
    expect(result.success).toBe(true)
    expect(result.exportedFiles).toEqual(['openclaw.json'])
    expect(fs.existsSync(path.join(targetDir, 'openclaw.json'))).toBe(true)
  })

  it('should allow import when source only contains openclaw.json', () => {
    const sourceDir = path.join(os.tmpdir(), `anyaitools-import-source-${Date.now()}`)
    fs.mkdirSync(sourceDir, { recursive: true })
    fs.writeFileSync(
      path.join(sourceDir, 'openclaw.json'),
      JSON.stringify({ currentProviderId: 'x', providers: [{ id: 'x' }], presets: [] }, null, 2),
      'utf-8'
    )

    const anyaitoolsDir = getAnyAIToolsDir()
    fs.mkdirSync(anyaitoolsDir, { recursive: true })
    fs.writeFileSync(
      path.join(anyaitoolsDir, 'openclaw.json'),
      JSON.stringify({ currentProviderId: 'legacy', providers: [] }, null, 2),
      'utf-8'
    )

    const validation = validateImportDir(sourceDir)
    expect(validation.valid).toBe(true)
    expect(validation.foundFiles).toEqual(['openclaw.json'])

    const result = importConfig(sourceDir)
    expect(result.success).toBe(true)
    expect(result.importedFiles).toEqual(['openclaw.json'])
    expect(result.backupPaths.length).toBe(1)

    const imported = JSON.parse(fs.readFileSync(path.join(anyaitoolsDir, 'openclaw.json'), 'utf-8'))
    expect(imported.currentProviderId).toBe('x')
  })

  it('should export a standalone Grok provider library', () => {
    const anyaitoolsDir = getAnyAIToolsDir()
    fs.mkdirSync(anyaitoolsDir, { recursive: true })
    fs.writeFileSync(
      path.join(anyaitoolsDir, 'grok.json'),
      JSON.stringify({ providers: [], presets: [] }, null, 2),
      'utf-8'
    )

    const validation = validateExport()
    expect(validation.valid).toBe(true)
    expect(validation.foundFiles).toEqual(['grok.json'])

    const targetDir = path.join(
      os.tmpdir(),
      `anyaitools-grok-export-target-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )
    const result = exportConfig(targetDir)
    expect(result.exportedFiles).toEqual(['grok.json'])
    expect(fs.existsSync(path.join(targetDir, 'grok.json'))).toBe(true)
  })

  it('should import and back up a standalone Grok provider library', () => {
    const sourceDir = path.join(
      os.tmpdir(),
      `anyaitools-grok-import-source-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )
    fs.mkdirSync(sourceDir, { recursive: true })
    fs.writeFileSync(
      path.join(sourceDir, 'grok.json'),
      JSON.stringify({ currentProviderId: 'grok-new', providers: [], presets: [] }, null, 2),
      'utf-8'
    )

    const anyaitoolsDir = getAnyAIToolsDir()
    fs.mkdirSync(anyaitoolsDir, { recursive: true })
    fs.writeFileSync(
      path.join(anyaitoolsDir, 'grok.json'),
      JSON.stringify({ currentProviderId: 'grok-old', providers: [] }, null, 2),
      'utf-8'
    )

    expect(validateImportDir(sourceDir).foundFiles).toEqual(['grok.json'])
    const result = importConfig(sourceDir)
    expect(result.importedFiles).toEqual(['grok.json'])
    expect(result.backupPaths).toHaveLength(1)
    expect(
      JSON.parse(fs.readFileSync(path.join(anyaitoolsDir, 'grok.json'), 'utf-8')).currentProviderId
    ).toBe('grok-new')
  })
})
