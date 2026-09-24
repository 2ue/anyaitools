import { describe, expect, it } from 'vitest'
import { CC_PRESETS } from './claude.js'
import { CODEX_PRESETS } from './codex.js'
import { GEMINI_PRESETS } from './gemini.js'
import { OPENCODE_PRESETS } from './opencode.js'
import { OPENCLAW_PRESETS } from './openclaw.js'
import { OKMCODE_ROOT_URL } from './okmcode.js'

function getPresetBaseUrl(
  presets: Array<{ name: string; baseUrl: string }>,
  name: string
): string | undefined {
  return presets.find((preset) => preset.name === name)?.baseUrl
}

describe('okmcode built-in presets', () => {
  it('should expose okmcode for Claude with root URL', () => {
    expect(getPresetBaseUrl(CC_PRESETS, 'okmcode')).toBe(OKMCODE_ROOT_URL)
  })

  it('should expose okmcode for Codex/Gemini/OpenCode', () => {
    for (const presets of [CODEX_PRESETS, GEMINI_PRESETS, OPENCODE_PRESETS]) {
      expect(getPresetBaseUrl(presets, 'okmcode')).toBe(OKMCODE_ROOT_URL)
    }
  })

  it('should expose okmcode for OpenClaw with /v1 URL', () => {
    expect(getPresetBaseUrl(OPENCLAW_PRESETS, 'okmcode')).toBe(`${OKMCODE_ROOT_URL}/v1`)
  })
})
