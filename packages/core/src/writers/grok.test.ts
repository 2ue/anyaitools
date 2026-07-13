import { beforeEach, describe, expect, it } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { parse as parseToml, stringify as stringifyToml } from '@iarna/toml'
import { __setTestPaths, getGrokConfigPath } from '../paths.js'
import type { Provider } from '../tool-manager.types.js'
import { removeGrokConfig, writeGrokConfig } from './grok.js'

describe('Grok Writer', () => {
  let testDir: string

  beforeEach(() => {
    testDir = path.join(
      os.tmpdir(),
      `anyaitools-grok-writer-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )
    __setTestPaths({
      anyaitools: path.join(testDir, '.anyaitools'),
      grok: path.join(testDir, '.grok'),
    })
    fs.rmSync(testDir, { recursive: true, force: true })
  })

  function createProvider(overrides: Partial<Provider> = {}): Provider {
    return {
      id: 'grok-stable-alias',
      name: 'Custom Grok',
      desc: 'Custom provider',
      baseUrl: 'https://gateway.example.test/custom/path',
      apiKey: 'sk-grok-test',
      model: 'custom-model',
      apiBackend: 'responses',
      supportsBackendSearch: true,
      createdAt: Date.now(),
      lastModified: Date.now(),
      ...overrides,
    }
  }

  function readConfig(): any {
    return parseToml(fs.readFileSync(getGrokConfigPath(), 'utf-8')) as any
  }

  function writeExistingConfig(config: Record<string, unknown>): void {
    const configPath = getGrokConfigPath()
    fs.mkdirSync(path.dirname(configPath), { recursive: true })
    fs.writeFileSync(configPath, stringifyToml(config as any), { mode: 0o644 })
  }

  it('writes an official model entry using the stable provider ID', () => {
    const provider = createProvider()

    writeGrokConfig(provider)

    const config = readConfig()
    expect(config.models.default).toBe(provider.id)
    expect(config.model[provider.id]).toMatchObject({
      model: 'custom-model',
      base_url: 'https://gateway.example.test/custom/path',
      name: 'Custom Grok',
      description: 'Custom provider',
      api_key: 'sk-grok-test',
      api_backend: 'responses',
      supports_backend_search: true,
    })
    expect(config.model[provider.name]).toBeUndefined()
    expect(fs.statSync(getGrokConfigPath()).mode & 0o777).toBe(0o600)
  })

  it('selects an official builtin model without creating a custom alias', () => {
    const provider = createProvider({
      baseUrl: '',
      apiKey: '',
      model: 'grok-build',
      apiBackend: undefined,
      supportsBackendSearch: undefined,
    })
    writeExistingConfig({
      models: { default: provider.id, web_search: 'auto' },
      model: {
        [provider.id]: {
          model: 'old-custom-model',
          base_url: 'https://old.example.test/v1',
          api_key: 'old-key',
        },
        manual: { model: 'manual-model', base_url: 'https://manual.example.test/v1' },
      },
      cli: { installer: 'npm' },
    })

    writeGrokConfig(provider, { mode: 'overwrite' })

    const config = readConfig()
    expect(config.models).toMatchObject({ default: 'grok-build', web_search: 'auto' })
    expect(config.model[provider.id]).toBeUndefined()
    expect(config.model.manual.model).toBe('manual-model')
    expect(config.cli.installer).toBe('npm')
  })

  it('merges safely while preserving unrelated sections and existing model options', () => {
    const provider = createProvider({
      model: 'existing-model',
      apiBackend: undefined,
      supportsBackendSearch: undefined,
      desc: undefined,
    })
    writeExistingConfig({
      models: { default: 'legacy', web_search: 'auto' },
      model: {
        legacy: { model: 'legacy-model', base_url: 'https://legacy.example.test' },
        [provider.id]: {
          model: 'existing-model',
          base_url: 'https://old.example.test',
          description: 'remove stale description',
          api_key: 'old-inline-key',
          env_key: 'EXISTING_GROK_KEY',
          api_backend: 'messages',
          supports_backend_search: true,
          temperature: 0.2,
        },
      },
      mcp_servers: { filesystem: { command: 'npx' } },
      plugins: { enabled: ['example'] },
      permission: { allow: ['read'] },
      auth: { provider: 'oauth' },
      cli: { installer: 'npm', npm_registry: 'https://registry.example.test' },
      custom: { keep: true },
    })

    writeGrokConfig(provider)

    const config = readConfig()
    expect(config.models.web_search).toBe('auto')
    expect(config.models.default).toBe(provider.id)
    expect(config.model.legacy.model).toBe('legacy-model')
    expect(config.model[provider.id]).toMatchObject({
      model: 'existing-model',
      base_url: provider.baseUrl,
      name: provider.name,
      api_key: provider.apiKey,
      api_backend: 'messages',
      supports_backend_search: true,
      temperature: 0.2,
    })
    expect(config.model[provider.id].description).toBeUndefined()
    expect(config.model[provider.id].env_key).toBeUndefined()
    expect(config.mcp_servers.filesystem.command).toBe('npx')
    expect(config.plugins.enabled).toEqual(['example'])
    expect(config.permission.allow).toEqual(['read'])
    expect(config.auth.provider).toBe('oauth')
    expect(config.cli).toMatchObject({
      installer: 'npm',
      npm_registry: 'https://registry.example.test',
    })
    expect(config.custom.keep).toBe(true)
  })

  it('removes a managed api_key when empty and preserves env_key for OAuth or environment auth', () => {
    const provider = createProvider({ apiKey: '' })
    writeExistingConfig({
      models: { default: provider.id },
      model: {
        [provider.id]: {
          model: 'custom-model',
          base_url: provider.baseUrl,
          api_key: 'old-inline-key',
          env_key: 'CUSTOM_GROK_KEY',
        },
      },
    })

    writeGrokConfig(provider)

    const model = readConfig().model[provider.id]
    expect(model.api_key).toBeUndefined()
    expect(model.env_key).toBe('CUSTOM_GROK_KEY')
  })

  it('overwrite resets only models/model and preserves other top-level sections', () => {
    const provider = createProvider()
    writeExistingConfig({
      models: { default: 'legacy', web_search: 'auto' },
      model: {
        legacy: { model: 'legacy-model' },
        [provider.id]: { model: 'old-model', temperature: 0.9 },
      },
      mcp_servers: { keep: { command: 'node' } },
      plugins: { keep: true },
      permission: { keep: true },
      auth: { keep: true },
      cli: { installer: 'npm', npm_registry: 'https://registry.example.test' },
    })

    writeGrokConfig(provider, { mode: 'overwrite' })

    const config = readConfig()
    expect(config.models).toEqual({ default: provider.id })
    expect(Object.keys(config.model)).toEqual([provider.id])
    expect(config.model[provider.id].temperature).toBeUndefined()
    expect(config.mcp_servers.keep.command).toBe('node')
    expect(config.plugins.keep).toBe(true)
    expect(config.permission.keep).toBe(true)
    expect(config.auth.keep).toBe(true)
    expect(config.cli.installer).toBe('npm')
    expect(config.cli.npm_registry).toBe('https://registry.example.test')
  })

  it('fails closed for invalid TOML and malformed managed sections', () => {
    const configPath = getGrokConfigPath()
    fs.mkdirSync(path.dirname(configPath), { recursive: true })
    const invalidToml = 'models = "unterminated\n'
    fs.writeFileSync(configPath, invalidToml, 'utf-8')

    expect(() => writeGrokConfig(createProvider())).toThrow('已中止切换以避免覆盖')
    expect(fs.readFileSync(configPath, 'utf-8')).toBe(invalidToml)

    fs.writeFileSync(configPath, 'models = "not-a-table"\n', 'utf-8')
    expect(() => writeGrokConfig(createProvider())).toThrow('models 必须是 table')
    expect(fs.readFileSync(configPath, 'utf-8')).toBe('models = "not-a-table"\n')
  })

  it('rejects invalid builtin credentials and missing models before writing', () => {
    expect(() =>
      writeGrokConfig(createProvider({ baseUrl: '', apiKey: 'must-not-be-written' }))
    ).toThrow('内置模型不能配置 API Key')
    expect(() => writeGrokConfig(createProvider({ model: '' }))).toThrow('模型不能为空')
    expect(fs.existsSync(getGrokConfigPath())).toBe(false)
  })

  it('removes only the managed alias and clears a matching default', () => {
    const provider = createProvider()
    writeExistingConfig({
      models: { default: provider.id, web_search: 'auto' },
      model: {
        [provider.id]: { model: provider.model, api_key: provider.apiKey },
        legacy: { model: 'legacy-model' },
      },
      cli: { installer: 'npm' },
    })

    removeGrokConfig(provider)

    const config = readConfig()
    expect(config.models.default).toBeUndefined()
    expect(config.models.web_search).toBe('auto')
    expect(config.model[provider.id]).toBeUndefined()
    expect(config.model.legacy.model).toBe('legacy-model')
    expect(config.cli.installer).toBe('npm')
  })

  it('clears a builtin default without deleting a matching builtin model table', () => {
    const provider = createProvider({
      id: 'builtin-provider-id',
      baseUrl: '',
      apiKey: '',
      model: 'grok-build',
      apiBackend: undefined,
      supportsBackendSearch: undefined,
    })
    writeExistingConfig({
      models: { default: 'grok-build' },
      model: {
        'grok-build': { model: 'catalog-override', temperature: 0.2 },
        [provider.id]: { model: 'old-custom-model', api_key: 'old-key' },
      },
    })

    removeGrokConfig(provider)

    const config = readConfig()
    expect(config.models.default).toBeUndefined()
    expect(config.model[provider.id]).toBeUndefined()
    expect(config.model['grok-build']).toMatchObject({
      model: 'catalog-override',
      temperature: 0.2,
    })
  })
})
