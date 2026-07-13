import { beforeEach, describe, expect, it } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { parse as parseToml } from '@iarna/toml'
import { createGrokManager } from './tool-manager.js'
import { __setTestPaths, getGrokConfigPath } from './paths.js'

describe('Grok ToolManager', () => {
  let testDir: string

  beforeEach(() => {
    testDir = path.join(
      os.tmpdir(),
      `anyaitools-grok-manager-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )
    __setTestPaths({
      anyaitools: path.join(testDir, '.anyaitools'),
      grok: path.join(testDir, '.grok'),
    })
    fs.rmSync(testDir, { recursive: true, force: true })
  })

  function readGrokConfig(): any {
    return parseToml(fs.readFileSync(getGrokConfigPath(), 'utf-8')) as any
  }

  it('preserves Grok fields across presets, CRUD, switching, cloning, and removal', () => {
    const manager = createGrokManager()
    const builtinPreset = manager.listPresets().find((preset) => preset.name === 'xAI Grok Build')
    expect(builtinPreset).toEqual(
      expect.objectContaining({
        name: 'xAI Grok Build',
        baseUrl: '',
        model: 'grok-build',
        isBuiltIn: true,
      })
    )
    expect(builtinPreset?.apiBackend).toBeUndefined()
    expect(builtinPreset?.supportsBackendSearch).toBeUndefined()

    const customPreset = manager.addPreset({
      name: 'Custom Grok Preset',
      baseUrl: 'https://preset.example.test/api',
      description: 'Custom preset',
      model: 'preset-model',
      apiBackend: 'messages',
      supportsBackendSearch: false,
    })
    expect(customPreset).toMatchObject({
      model: 'preset-model',
      apiBackend: 'messages',
      supportsBackendSearch: false,
    })

    const provider = manager.add({
      name: '  Work Grok  ',
      desc: '  Initial  ',
      baseUrl: '  https://gateway.example.test/custom  ',
      apiKey: '  sk-initial  ',
      model: '  work-model  ',
      apiBackend: 'responses',
      supportsBackendSearch: true,
    })
    expect(provider).toMatchObject({
      name: 'Work Grok',
      desc: 'Initial',
      baseUrl: 'https://gateway.example.test/custom',
      apiKey: 'sk-initial',
      model: 'work-model',
      apiBackend: 'responses',
      supportsBackendSearch: true,
    })

    manager.switch(provider.id)
    expect(manager.getCurrent()?.id).toBe(provider.id)
    expect(readGrokConfig().models.default).toBe(provider.id)

    manager.edit(provider.id, {
      name: 'Renamed Grok',
      apiKey: '',
      model: 'renamed-model',
      apiBackend: 'messages',
      supportsBackendSearch: false,
    })
    const editedConfig = readGrokConfig()
    expect(editedConfig.models.default).toBe(provider.id)
    expect(editedConfig.model[provider.id]).toMatchObject({
      name: 'Renamed Grok',
      model: 'renamed-model',
      api_backend: 'messages',
      supports_backend_search: false,
    })
    expect(editedConfig.model[provider.id].api_key).toBeUndefined()
    expect(editedConfig.model['Renamed Grok']).toBeUndefined()

    const clone = manager.clone(provider.id, 'Cloned Grok')
    expect(clone).toMatchObject({
      model: 'renamed-model',
      apiBackend: 'messages',
      supportsBackendSearch: false,
    })

    manager.remove(provider.id)
    expect(manager.getCurrent()).toBeNull()
    expect(manager.list().map((item) => item.id)).toEqual([clone.id])
    const removedConfig = readGrokConfig()
    expect(removedConfig.models.default).toBeUndefined()
    expect(removedConfig.model?.[provider.id]).toBeUndefined()
  })

  it('does not advance or delete internal state when the target TOML is invalid', () => {
    const manager = createGrokManager()
    const provider = manager.add({
      name: 'Fail Closed',
      baseUrl: 'https://example.test/v1',
      apiKey: '',
      model: 'test-model',
      apiBackend: 'chat_completions',
      supportsBackendSearch: false,
    })
    const configPath = getGrokConfigPath()
    fs.mkdirSync(path.dirname(configPath), { recursive: true })
    fs.writeFileSync(configPath, 'models = "unterminated\n', 'utf-8')

    expect(() => manager.switch(provider.id)).toThrow('已中止切换以避免覆盖')
    expect(manager.getCurrent()).toBeNull()
    expect(manager.get(provider.id).lastUsedAt).toBeUndefined()

    expect(() => manager.remove(provider.id)).toThrow('已中止切换以避免覆盖')
    expect(manager.get(provider.id).id).toBe(provider.id)
  })

  it('validates builtin and custom Grok providers before changing internal state', () => {
    const manager = createGrokManager()

    expect(() =>
      manager.add({
        name: 'Missing Model',
        baseUrl: '',
        apiKey: '',
      })
    ).toThrow('模型不能为空')
    expect(() =>
      manager.add({
        name: 'Builtin With Key',
        baseUrl: '',
        apiKey: 'not-allowed',
        model: 'grok-build',
      })
    ).toThrow('内置模型不能配置 API Key')
    expect(() =>
      manager.add({
        name: 'Invalid URL',
        baseUrl: 'ftp://example.test/model',
        apiKey: '',
        model: 'custom-model',
      })
    ).toThrow('仅支持 http(s) URL')
    expect(() =>
      manager.add({
        name: 'Invalid Backend',
        baseUrl: 'https://example.test/v1',
        apiKey: '',
        model: 'custom-model',
        apiBackend: 'invalid' as any,
      })
    ).toThrow('不支持的 Grok API backend')
    expect(() =>
      manager.add({
        name: 'Invalid Search Flag',
        baseUrl: 'https://example.test/v1',
        apiKey: '',
        model: 'custom-model',
        supportsBackendSearch: 'yes' as any,
      })
    ).toThrow('必须是布尔值')
    expect(manager.list()).toEqual([])

    expect(() =>
      manager.addPreset({
        name: 'Preset Missing Model',
        baseUrl: '',
        description: 'Invalid',
      })
    ).toThrow('模型不能为空')
    expect(() =>
      manager.addPreset({
        name: 'Preset Invalid URL',
        baseUrl: 'file:///tmp/model',
        description: 'Invalid',
        model: 'custom-model',
      })
    ).toThrow('仅支持 http(s) URL')
    expect(() =>
      manager.addPreset({
        name: 'Preset Invalid Backend',
        baseUrl: 'https://example.test/v1',
        description: 'Invalid',
        model: 'custom-model',
        apiBackend: 'invalid' as any,
      })
    ).toThrow('不支持的 Grok API backend')
    expect(() =>
      manager.addPreset({
        name: 'Preset Invalid Search Flag',
        baseUrl: 'https://example.test/v1',
        description: 'Invalid',
        model: 'custom-model',
        supportsBackendSearch: 'yes' as any,
      })
    ).toThrow('必须是布尔值')

    const validPreset = manager.addPreset({
      name: 'Valid Grok Preset',
      baseUrl: 'https://example.test/v1',
      description: 'Valid',
      model: 'custom-model',
      apiBackend: 'responses',
      supportsBackendSearch: true,
    })
    expect(() => manager.editPreset(validPreset.name, { model: '' })).toThrow('模型不能为空')
    expect(manager.listPresets().find((preset) => preset.name === validPreset.name)?.model).toBe(
      'custom-model'
    )

    const builtin = manager.add({
      name: 'Builtin Grok',
      baseUrl: '',
      apiKey: '',
      model: 'grok-build',
    })
    manager.switch(builtin.id)
    const config = readGrokConfig()
    expect(config.models.default).toBe('grok-build')
    expect(config.model).toBeUndefined()

    expect(() => manager.edit(builtin.id, { apiKey: 'not-allowed' })).toThrow(
      '内置模型不能配置 API Key'
    )
    expect(manager.get(builtin.id).apiKey).toBe('')

    manager.remove(builtin.id)
    expect(readGrokConfig().models.default).toBeUndefined()
  })

  it('keeps a shared builtin default when removing an inactive provider', () => {
    const manager = createGrokManager()
    const first = manager.add({
      name: 'Builtin Grok One',
      baseUrl: '',
      apiKey: '',
      model: 'grok-build',
    })
    const second = manager.add({
      name: 'Builtin Grok Two',
      baseUrl: '',
      apiKey: '',
      model: 'grok-build',
    })

    manager.switch(second.id)
    manager.remove(first.id)

    expect(manager.getCurrent()?.id).toBe(second.id)
    expect(readGrokConfig().models.default).toBe('grok-build')

    manager.remove(second.id)
    expect(readGrokConfig().models.default).toBeUndefined()
  })

  it('rolls back an active provider edit when the Grok writer fails', () => {
    const manager = createGrokManager()
    const provider = manager.add({
      name: 'Rollback Grok',
      baseUrl: 'https://before.example.test/v1',
      apiKey: 'sk-before',
      model: 'before-model',
      apiBackend: 'responses',
      supportsBackendSearch: true,
    })
    manager.switch(provider.id)
    fs.writeFileSync(getGrokConfigPath(), 'model = "unterminated\n', 'utf-8')

    expect(() =>
      manager.edit(provider.id, {
        baseUrl: 'https://after.example.test/v1',
        apiKey: '',
        model: 'after-model',
        apiBackend: 'messages',
        supportsBackendSearch: false,
      })
    ).toThrow('已中止切换以避免覆盖')

    expect(manager.get(provider.id)).toMatchObject({
      baseUrl: 'https://before.example.test/v1',
      apiKey: 'sk-before',
      model: 'before-model',
      apiBackend: 'responses',
      supportsBackendSearch: true,
    })
    expect(manager.getCurrent()?.id).toBe(provider.id)
  })
})
