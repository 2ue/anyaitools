import { beforeEach, describe, expect, it } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { getCodexSettings, setCodexPreserveProviderName } from './codex-settings.js'
import { getAnyAIToolsDir, __setTestPaths } from './paths.js'

describe('Codex settings', () => {
  beforeEach(() => {
    const testDir = path.join(
      os.tmpdir(),
      `anyaitools-codex-settings-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )
    __setTestPaths({
      anyaitools: path.join(testDir, '.anyaitools'),
      codex: path.join(testDir, '.codex'),
      claude: path.join(testDir, '.claude'),
    })
    fs.rmSync(testDir, { recursive: true, force: true })
  })

  it('preserves provider names by default', () => {
    expect(getCodexSettings()).toEqual({ preserveProviderName: true })
  })

  it('persists an explicit opt-out without replacing unrelated store data', () => {
    const storePath = path.join(getAnyAIToolsDir(), 'codex.json')
    fs.mkdirSync(path.dirname(storePath), { recursive: true })
    fs.writeFileSync(
      storePath,
      JSON.stringify({
        providers: [{ id: 'keep-me' }],
        presets: [],
        custom: 'keep',
        settings: { preserveProviderName: false, customSetting: 42 },
      }),
      'utf-8'
    )

    expect(getCodexSettings().preserveProviderName).toBe(false)
    expect(setCodexPreserveProviderName(true)).toEqual({ preserveProviderName: true })
    expect(getCodexSettings().preserveProviderName).toBe(true)

    const stored = JSON.parse(fs.readFileSync(storePath, 'utf-8'))
    expect(stored.providers).toEqual([{ id: 'keep-me' }])
    expect(stored.custom).toBe('keep')
    expect(stored.settings).toEqual({ preserveProviderName: true, customSetting: 42 })
  })

  it('rejects non-boolean values', () => {
    expect(() => setCodexPreserveProviderName('true' as never)).toThrow(
      'preserveProviderName 必须是布尔值'
    )
  })
})
