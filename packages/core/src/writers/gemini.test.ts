import { describe, it, expect, beforeEach } from 'vitest'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import { writeGeminiConfig } from './gemini.js'
import { getGeminiSettingsPath, getGeminiEnvPath, __setTestPaths } from '../paths.js'
import type { Provider } from '../tool-manager.types.js'

describe('Gemini Writer', () => {
  beforeEach(() => {
    const testDir = path.join(
      os.tmpdir(),
      `anyaitools-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )
    __setTestPaths({
      anyaitools: path.join(testDir, '.anyaitools'),
      codex: path.join(testDir, '.codex'),
      claude: path.join(testDir, '.claude'),
      gemini: path.join(testDir, '.gemini'),
    })

    const settingsPath = getGeminiSettingsPath()
    const envPath = getGeminiEnvPath()
    const settingsDir = path.dirname(settingsPath)
    if (fs.existsSync(settingsDir)) {
      fs.rmSync(settingsDir, { recursive: true, force: true })
    }
    const envDir = path.dirname(envPath)
    if (fs.existsSync(envDir)) {
      fs.rmSync(envDir, { recursive: true, force: true })
    }
  })

  it('should create new settings.json and .env for okmcode provider', () => {
    const provider: Provider = {
      id: 'gemini-1',
      name: 'okmcode',
      baseUrl: 'https://okmcode.com',
      apiKey: 'sk-test-123',
      createdAt: Date.now(),
      lastModified: Date.now(),
    }

    writeGeminiConfig(provider)

    const settingsPath = getGeminiSettingsPath()
    expect(fs.existsSync(settingsPath)).toBe(true)

    const rawSettings = fs.readFileSync(settingsPath, 'utf-8')
    const settings = JSON.parse(rawSettings)

    // 模型默认通过 .env 的 GEMINI_MODEL 托管。
    expect(settings.model).toBeUndefined()
    // 默认开启 IDE 集成 & 设置认证方式
    expect(settings.ide?.enabled).toBe(true)
    expect(settings.security?.auth?.selectedType).toBe('gemini-api-key')

    const envPath = getGeminiEnvPath()
    expect(fs.existsSync(envPath)).toBe(true)
    const envContent = fs.readFileSync(envPath, 'utf-8')
    expect(envContent).toContain('GOOGLE_GEMINI_BASE_URL=https://okmcode.com')
    expect(envContent).toContain('GEMINI_API_KEY=sk-test-123')
    expect(envContent).toContain('GEMINI_MODEL=gemini-3.5-flash')
  })

  it('should respect defaultModel and env in provider.model', () => {
    const meta = {
      authType: 'oauth',
      defaultModel: 'gemini-2.5-flash',
      env: {
        GEMINI_MODEL: 'gemini-2.5-flash',
      },
    }

    const provider: Provider = {
      id: 'gemini-2',
      name: 'Google OAuth',
      baseUrl: '',
      apiKey: '',
      model: JSON.stringify(meta),
      createdAt: Date.now(),
      lastModified: Date.now(),
    }

    writeGeminiConfig(provider)

    const settings = JSON.parse(fs.readFileSync(getGeminiSettingsPath(), 'utf-8'))
    expect(settings.security?.auth?.selectedType).toBe('oauth-personal')

    const envPath = getGeminiEnvPath()
    const envContent = fs.readFileSync(envPath, 'utf-8')
    // 合并 meta.env 中的 GEMINI_MODEL
    expect(envContent).toContain('GEMINI_MODEL=gemini-2.5-flash')
  })

  it('switches auth mode when replacing OAuth with an API-key provider', () => {
    const settingsPath = getGeminiSettingsPath()
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true })
    fs.writeFileSync(
      settingsPath,
      JSON.stringify({ security: { auth: { selectedType: 'oauth-personal' } } }),
      'utf-8'
    )

    const provider: Provider = {
      id: 'gemini-api-key-switch',
      name: 'API Key',
      baseUrl: 'https://example.com',
      apiKey: 'sk-api-key',
      createdAt: Date.now(),
      lastModified: Date.now(),
    }

    writeGeminiConfig(provider)

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
    expect(settings.security?.auth?.selectedType).toBe('gemini-api-key')
  })

  it('ignores malformed auth metadata instead of failing the config write', () => {
    const provider: Provider = {
      id: 'gemini-invalid-auth-meta',
      name: 'Malformed Metadata',
      baseUrl: 'https://example.com',
      apiKey: 'sk-api-key',
      model: JSON.stringify({ authType: { unsupported: true } }),
      createdAt: Date.now(),
      lastModified: Date.now(),
    }

    expect(() => writeGeminiConfig(provider)).not.toThrow()
    const settings = JSON.parse(fs.readFileSync(getGeminiSettingsPath(), 'utf-8'))
    expect(settings.security?.auth?.selectedType).toBe('gemini-api-key')
  })

  it('should fallback GEMINI_MODEL from defaultModel when not provided in env', () => {
    const meta = {
      defaultModel: 'gemini-custom-model',
    }

    const provider: Provider = {
      id: 'gemini-2b',
      name: 'Google API Key',
      baseUrl: '',
      apiKey: '',
      model: JSON.stringify(meta),
      createdAt: Date.now(),
      lastModified: Date.now(),
    }

    writeGeminiConfig(provider)

    const envPath = getGeminiEnvPath()
    const envContent = fs.readFileSync(envPath, 'utf-8')
    expect(envContent).toContain('GEMINI_MODEL=gemini-custom-model')
  })

  it('should preserve existing unrelated fields when updating', () => {
    const settingsPath = getGeminiSettingsPath()
    const dir = path.dirname(settingsPath)
    fs.mkdirSync(dir, { recursive: true })

    const existing = {
      someField: 'keep-me',
    }
    fs.writeFileSync(settingsPath, JSON.stringify(existing, null, 2), 'utf-8')

    const provider: Provider = {
      id: 'gemini-3',
      name: 'Proxy',
      baseUrl: 'http://localhost:5000',
      apiKey: 'sk-xyz',
      createdAt: Date.now(),
      lastModified: Date.now(),
    }

    writeGeminiConfig(provider)

    const rawSettings = fs.readFileSync(settingsPath, 'utf-8')
    const settings = JSON.parse(rawSettings)
    expect(settings.someField).toBe('keep-me')

    const envPath = getGeminiEnvPath()
    const envContent = fs.readFileSync(envPath, 'utf-8')
    expect(envContent).toContain('GOOGLE_GEMINI_BASE_URL=http://localhost:5000')
    expect(envContent).toContain('GEMINI_API_KEY=sk-xyz')
  })

  it('should preserve existing env variables while applying managed template vars', () => {
    const envPath = getGeminiEnvPath()
    fs.mkdirSync(path.dirname(envPath), { recursive: true })
    fs.writeFileSync(
      envPath,
      ['CUSTOM_ENV=keep', 'GEMINI_MODEL=gemini-2.0-flash-exp'].join('\n') + '\n',
      'utf-8'
    )

    const provider: Provider = {
      id: 'gemini-4',
      name: 'okmcode',
      baseUrl: 'https://okmcode.com',
      apiKey: 'sk-new',
      createdAt: Date.now(),
      lastModified: Date.now(),
    }

    writeGeminiConfig(provider)

    const nextEnv = fs.readFileSync(envPath, 'utf-8')
    expect(nextEnv).toContain('CUSTOM_ENV=keep')
    expect(nextEnv).toContain('GEMINI_MODEL=gemini-2.0-flash-exp')
    expect(nextEnv).toContain('GOOGLE_GEMINI_BASE_URL=https://okmcode.com')
    expect(nextEnv).toContain('GEMINI_API_KEY=sk-new')
  })

  it('should let a plain provider model override an existing model', () => {
    const envPath = getGeminiEnvPath()
    fs.mkdirSync(path.dirname(envPath), { recursive: true })
    fs.writeFileSync(envPath, 'GEMINI_MODEL=existing-model\n', 'utf-8')

    const provider: Provider = {
      id: 'gemini-plain-model',
      name: 'Custom',
      baseUrl: 'https://example.com',
      apiKey: 'sk-plain',
      model: 'explicit-plain-model',
      createdAt: Date.now(),
      lastModified: Date.now(),
    }

    writeGeminiConfig(provider)

    expect(fs.readFileSync(envPath, 'utf-8')).toContain('GEMINI_MODEL=explicit-plain-model')
  })

  it('should let meta.env override an existing model while defaultModel remains a fallback', () => {
    const envPath = getGeminiEnvPath()
    fs.mkdirSync(path.dirname(envPath), { recursive: true })
    fs.writeFileSync(envPath, 'GEMINI_MODEL=existing-model\n', 'utf-8')

    const provider: Provider = {
      id: 'gemini-meta-env-model',
      name: 'Custom',
      baseUrl: 'https://example.com',
      apiKey: 'sk-meta',
      model: JSON.stringify({
        defaultModel: 'fallback-model',
        env: { GEMINI_MODEL: 'explicit-meta-env-model' },
      }),
      createdAt: Date.now(),
      lastModified: Date.now(),
    }

    writeGeminiConfig(provider)

    const envContent = fs.readFileSync(envPath, 'utf-8')
    expect(envContent).toContain('GEMINI_MODEL=explicit-meta-env-model')
    expect(envContent).not.toContain('GEMINI_MODEL=fallback-model')
  })

  it('should preserve an existing model over meta.defaultModel in merge mode', () => {
    const envPath = getGeminiEnvPath()
    fs.mkdirSync(path.dirname(envPath), { recursive: true })
    fs.writeFileSync(envPath, 'GEMINI_MODEL=existing-model\n', 'utf-8')

    const provider: Provider = {
      id: 'gemini-meta-fallback-model',
      name: 'Custom',
      baseUrl: 'https://example.com',
      apiKey: 'sk-meta-fallback',
      model: JSON.stringify({ defaultModel: 'fallback-model' }),
      createdAt: Date.now(),
      lastModified: Date.now(),
    }

    writeGeminiConfig(provider)

    expect(fs.readFileSync(envPath, 'utf-8')).toContain('GEMINI_MODEL=existing-model')
  })

  it('should overwrite settings and env in overwrite mode', () => {
    const settingsPath = getGeminiSettingsPath()
    const envPath = getGeminiEnvPath()
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true })
    fs.writeFileSync(
      settingsPath,
      JSON.stringify(
        {
          someField: 'remove-me',
          ide: { enabled: false },
        },
        null,
        2
      ),
      'utf-8'
    )
    fs.writeFileSync(
      envPath,
      ['CUSTOM_ENV=remove-me', 'GEMINI_MODEL=legacy-model'].join('\n') + '\n'
    )

    const provider: Provider = {
      id: 'gemini-overwrite',
      name: 'okmcode',
      baseUrl: 'https://okmcode.com',
      apiKey: 'sk-overwrite',
      createdAt: Date.now(),
      lastModified: Date.now(),
    }

    writeGeminiConfig(provider, { mode: 'overwrite' })

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
    expect(settings.someField).toBeUndefined()
    expect(settings.ide.enabled).toBe(true)

    const envContent = fs.readFileSync(envPath, 'utf-8')
    expect(envContent).not.toContain('CUSTOM_ENV=remove-me')
    expect(envContent).not.toContain('GEMINI_MODEL=legacy-model')
    expect(envContent).toContain('GOOGLE_GEMINI_BASE_URL=https://okmcode.com')
    expect(envContent).toContain('GEMINI_API_KEY=sk-overwrite')
    expect(envContent).toContain('GEMINI_MODEL=gemini-3.5-flash')
  })

  it('should let meta.defaultModel override the template default in overwrite mode', () => {
    const provider: Provider = {
      id: 'gemini-overwrite-default-model',
      name: 'Custom',
      baseUrl: 'https://example.com',
      apiKey: 'sk-overwrite-default',
      model: JSON.stringify({ defaultModel: 'overwrite-meta-model' }),
      createdAt: Date.now(),
      lastModified: Date.now(),
    }

    writeGeminiConfig(provider, { mode: 'overwrite' })

    expect(fs.readFileSync(getGeminiEnvPath(), 'utf-8')).toContain(
      'GEMINI_MODEL=overwrite-meta-model'
    )
  })
})
