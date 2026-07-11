import * as path from 'path'
import { getAnyAIToolsDir } from './paths.js'
import { fileExists, readJSON, writeJSON } from './utils/file.js'

export interface CodexSettings {
  preserveProviderName: boolean
}

interface CodexStore {
  providers?: unknown[]
  presets?: unknown[]
  settings?: unknown
  [key: string]: unknown
}

const DEFAULT_CODEX_SETTINGS: CodexSettings = {
  preserveProviderName: false,
}

function getCodexStorePath(): string {
  return path.join(getAnyAIToolsDir(), 'codex.json')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function loadCodexStore(): CodexStore {
  const configPath = getCodexStorePath()
  if (!fileExists(configPath)) {
    return { providers: [], presets: [] }
  }
  return readJSON<CodexStore>(configPath)
}

export function getCodexSettings(): CodexSettings {
  const config = loadCodexStore()
  const settings = isRecord(config.settings) ? config.settings : {}

  return {
    preserveProviderName: settings.preserveProviderName === true,
  }
}

export function setCodexPreserveProviderName(enabled: boolean): CodexSettings {
  if (typeof enabled !== 'boolean') {
    throw new Error('preserveProviderName 必须是布尔值')
  }

  const config = loadCodexStore()
  const settings = isRecord(config.settings) ? config.settings : {}
  const nextSettings: CodexSettings = {
    ...DEFAULT_CODEX_SETTINGS,
    preserveProviderName: enabled,
  }

  config.settings = {
    ...settings,
    ...nextSettings,
  }
  writeJSON(getCodexStorePath(), config)
  return nextSettings
}
