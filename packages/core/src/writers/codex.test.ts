import { describe, it, expect, beforeEach } from 'vitest'
import { writeCodexConfig } from './codex'
import { getAnyAIToolsDir, getCodexConfigPath, getCodexAuthPath, __setTestPaths } from '../paths'
import { getCodexSettings, setCodexPreserveProviderName } from '../codex-settings'
import { fileExists } from '../utils/file'
import type { Provider } from '../types'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import * as TOML from '@iarna/toml'

describe('Codex Writer', () => {
  beforeEach(() => {
    // 设置测试环境路径（使用随机数避免并发冲突）
    const testDir = path.join(
      os.tmpdir(),
      `anyaitools-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )
    __setTestPaths({
      anyaitools: path.join(testDir, '.anyaitools'),
      codex: path.join(testDir, '.codex'),
      claude: path.join(testDir, '.claude'),
    })

    // 清理测试文件
    const codexPath = getCodexConfigPath()
    if (fileExists(codexPath)) {
      fs.unlinkSync(codexPath)
    }
    const authPath = getCodexAuthPath()
    if (fileExists(authPath)) {
      fs.unlinkSync(authPath)
    }
  })

  describe('writeCodexConfig', () => {
    it('should create new config and auth files', () => {
      const provider: Provider = {
        id: 'test-id',
        name: 'TestProvider',
        type: 'codex',
        baseUrl: 'https://test.example.com/v1',
        apiKey: 'test-api-key-123',
        createdAt: Date.now(),
      }

      writeCodexConfig(provider)

      // 验证 config.toml
      const configPath = getCodexConfigPath()
      expect(fileExists(configPath)).toBe(true)
      const configContent = fs.readFileSync(configPath, 'utf-8')
      const config: any = TOML.parse(configContent)

      expect(config.model_provider).toBe(provider.name)
      expect(config.profile).toBeUndefined()
      expect(config.profiles).toBeUndefined()
      expect(config.model_providers[provider.name]).toBeDefined()
      expect(config.model_providers[provider.name].base_url).toBe(provider.baseUrl)

      // 验证 auth.json
      const authPath = getCodexAuthPath()
      expect(fileExists(authPath)).toBe(true)
      const authContent = fs.readFileSync(authPath, 'utf-8')
      const auth = JSON.parse(authContent)
      expect(auth.OPENAI_API_KEY).toBe(provider.apiKey)
    })

    it('should use okmcode as provider key for OKMCode baseUrl', () => {
      const provider: Provider = {
        id: 'test-id',
        name: 'OKMCode',
        type: 'codex',
        baseUrl: 'https://okmcode.com',
        apiKey: 'test-api-key-123',
        createdAt: Date.now(),
      }

      writeCodexConfig(provider)

      const configContent = fs.readFileSync(getCodexConfigPath(), 'utf-8')
      const config: any = TOML.parse(configContent)

      expect(config.model_provider).toBe('okmcode')
      expect(config.model).toBe('gpt-5.5')
      expect(config.review_model).toBe('gpt-5.5')
      expect(config.plan_mode_reasoning_effort).toBe('xhigh')
      expect(config.model_reasoning_summary).toBe('auto')
      expect(config.model_verbosity).toBe('high')
      expect(config.personality).toBe('pragmatic')
      expect(config.disable_response_storage).toBeUndefined()
      expect(config.windows.sandbox).toBe('elevated')
      expect(config.model_providers.okmcode).toBeDefined()
      expect(config.model_providers.okmcode.base_url).toBe(provider.baseUrl)
      expect(config.model_providers.OKMCode).toBeUndefined()
      expect(config.features.plan_tool).toBeUndefined()
      expect(config.features.view_image_tool).toBeUndefined()
      expect(config.features.streamable_shell).toBeUndefined()
      expect(config.features.rmcp_client).toBeUndefined()
      expect(config.features.apply_patch_freeform).toBeUndefined()
      expect(config.features.elevated_windows_sandbox).toBeUndefined()
      expect(config.features.multi_agent).toBe(true)
    })

    it('should use okmcode as provider key for OKMCode subdomains', () => {
      const provider: Provider = {
        id: 'test-id',
        name: '自定义 OKMCode',
        type: 'codex',
        baseUrl: 'https://api.okmcode.com/v1',
        apiKey: 'test-api-key-123',
        createdAt: Date.now(),
      }

      writeCodexConfig(provider)

      const configContent = fs.readFileSync(getCodexConfigPath(), 'utf-8')
      const config: any = TOML.parse(configContent)

      expect(config.model_provider).toBe('okmcode')
      expect(config.model_providers.okmcode.base_url).toBe(provider.baseUrl)
      expect(config.model_providers['自定义 OKMCode']).toBeUndefined()
    })

    it('should not classify unrelated URLs that merely contain the OKMCode domain text', () => {
      const provider: Provider = {
        id: 'test-id-unrelated',
        name: 'CustomProvider',
        type: 'codex',
        baseUrl: 'https://not-okmcode.com/okmcode.com/v1',
        apiKey: 'test-api-key-123',
        createdAt: Date.now(),
      }

      writeCodexConfig(provider)

      const configContent = fs.readFileSync(getCodexConfigPath(), 'utf-8')
      const config: any = TOML.parse(configContent)

      expect(config.model_provider).toBe('CustomProvider')
      expect(config.model_providers.CustomProvider.base_url).toBe(provider.baseUrl)
    })

    it('should remove deprecated web_search_request while preserving unrelated fields in merge mode', () => {
      const configPath = getCodexConfigPath()
      fs.mkdirSync(path.dirname(configPath), { recursive: true })

      const existingConfig = {
        model_provider: 'OKMCode',
        custom_field: 'should-be-preserved',
        profile: 'auto-max',
        web_search_request: true,
        disable_response_storage: true,
        network_access: 'enabled',
        windows_wsl_setup_acknowledged: true,
        experimental_use_exec_command_tool: true,
        include_apply_patch_tool: true,
        profiles: {
          'auto-max': {
            approval_policy: 'never',
            sandbox_mode: 'workspace-write',
          },
          review: {
            approval_policy: 'on-request',
            sandbox_mode: 'workspace-write',
          },
        },
        model_providers: {
          OKMCode: {
            name: 'OKMCode',
            base_url: 'https://old.example.com',
            wire_api: 'responses',
            requires_openai_auth: true,
            env_key: 'STALE_API_KEY',
            http_headers: { 'X-Keep': 'preserved' },
          },
        },
        features: {
          web_search_request: true,
          web_search_cached: true,
          web_search: true,
          plan_tool: true,
          view_image_tool: true,
          streamable_shell: false,
          rmcp_client: true,
          apply_patch_freeform: true,
          elevated_windows_sandbox: false,
          unified_exec: false,
          hooks: true,
        },
      }

      fs.writeFileSync(configPath, TOML.stringify(existingConfig as any), 'utf-8')

      const provider: Provider = {
        id: 'test-id',
        name: 'OKMCode',
        type: 'codex',
        baseUrl: 'https://okmcode.com',
        apiKey: 'test-api-key-123',
        createdAt: Date.now(),
      }
      setCodexPreserveProviderName(false)
      writeCodexConfig(provider)

      const configContent = fs.readFileSync(getCodexConfigPath(), 'utf-8')
      const config: any = TOML.parse(configContent)

      expect(config.features?.web_search_request).toBeUndefined()
      expect(config.features?.web_search_cached).toBeUndefined()
      expect(config.features?.web_search).toBeUndefined()
      expect(config.features?.plan_tool).toBeUndefined()
      expect(config.features?.view_image_tool).toBeUndefined()
      expect(config.features?.streamable_shell).toBeUndefined()
      expect(config.features?.rmcp_client).toBeUndefined()
      expect(config.features?.apply_patch_freeform).toBeUndefined()
      expect(config.features?.elevated_windows_sandbox).toBeUndefined()
      expect(config.features?.unified_exec).toBe(false)
      expect(config.features?.hooks).toBe(true)
      expect(config.web_search_request).toBeUndefined()
      expect(config.disable_response_storage).toBeUndefined()
      expect(config.network_access).toBeUndefined()
      expect(config.experimental_use_exec_command_tool).toBeUndefined()
      expect(config.include_apply_patch_tool).toBeUndefined()
      expect(config.profile).toBeUndefined()
      expect(config.profiles).toBeUndefined()
      expect(config.windows.sandbox).toBe('unelevated')
      expect(config.windows_wsl_setup_acknowledged).toBe(
        process.platform === 'win32' ? true : undefined
      )
      expect(config.model_providers.okmcode.http_headers['X-Keep']).toBe('preserved')
      expect(config.model_providers.okmcode.env_key).toBeUndefined()
      expect(config.custom_field).toBe('should-be-preserved')
      expect(fs.existsSync(`${configPath}.bak`)).toBe(false)
    })

    it('should merge config.toml and auth.json by default', () => {
      const configPath = getCodexConfigPath()
      const authPath = getCodexAuthPath()

      // 创建包含额外字段的配置
      const existingConfig = {
        model_provider: 'OldProvider',
        model: 'some-model',
        custom_field: 'should-be-preserved',
        model_providers: {
          OldProvider: {
            name: 'OldProvider',
            base_url: 'https://old.example.com',
          },
          newprovider: {
            name: 'old-new-provider',
            base_url: 'https://stale.example.com',
            wire_api: 'responses',
            requires_openai_auth: false,
            env_key: 'STALE_API_KEY',
            env_key_instructions: 'stale instructions',
            experimental_bearer_token: 'stale-token',
            auth: { command: 'stale-auth' },
            aws: { profile: 'stale-profile' },
            query_params: { apiVersion: '2026-01-01' },
            http_headers: { 'X-Custom': 'keep-me' },
            env_http_headers: { 'X-From-Env': 'CUSTOM_HEADER' },
            request_max_retries: 7,
            stream_max_retries: 8,
            stream_idle_timeout_ms: 9000,
            supports_websockets: true,
            websocket_connect_timeout_ms: 3000,
          },
        },
      }

      const existingAuth = {
        OPENAI_API_KEY: 'old-key',
        CUSTOM_FIELD: 'should-be-preserved',
      }

      fs.mkdirSync(path.dirname(configPath), { recursive: true })
      fs.writeFileSync(configPath, TOML.stringify(existingConfig as any), 'utf-8')
      fs.writeFileSync(authPath, JSON.stringify(existingAuth, null, 2), 'utf-8')

      // 更新配置
      const provider: Provider = {
        id: 'new-id',
        name: 'NewProvider',
        type: 'codex',
        baseUrl: 'https://new.example.com',
        apiKey: 'new-key',
        createdAt: Date.now(),
      }
      setCodexPreserveProviderName(false)
      writeCodexConfig(provider)

      // 验证 config.toml
      const configContent = fs.readFileSync(configPath, 'utf-8')
      const config: any = TOML.parse(configContent)

      expect(config.model_provider).toBe('NewProvider')
      expect(config.model_providers.NewProvider.base_url).toBe('https://new.example.com')
      expect(config.custom_field).toBe('should-be-preserved')
      expect(config.model_providers.OldProvider.base_url).toBe('https://old.example.com')
      expect(config.model_providers.newprovider).toBeUndefined()
      expect(config.model_providers.NewProvider.query_params.apiVersion).toBe('2026-01-01')
      expect(config.model_providers.NewProvider.http_headers['X-Custom']).toBe('keep-me')
      expect(config.model_providers.NewProvider.env_http_headers['X-From-Env']).toBe(
        'CUSTOM_HEADER'
      )
      expect(config.model_providers.NewProvider.request_max_retries).toBe(7)
      expect(config.model_providers.NewProvider.stream_max_retries).toBe(8)
      expect(config.model_providers.NewProvider.stream_idle_timeout_ms).toBe(9000)
      expect(config.model_providers.NewProvider.supports_websockets).toBe(true)
      expect(config.model_providers.NewProvider.websocket_connect_timeout_ms).toBe(3000)
      expect(config.model_providers.NewProvider.env_key).toBeUndefined()
      expect(config.model_providers.NewProvider.env_key_instructions).toBeUndefined()
      expect(config.model_providers.NewProvider.experimental_bearer_token).toBeUndefined()
      expect(config.model_providers.NewProvider.auth).toBeUndefined()
      expect(config.model_providers.NewProvider.aws).toBeUndefined()

      // 验证 auth.json
      const authContent = fs.readFileSync(authPath, 'utf-8')
      const auth = JSON.parse(authContent)
      expect(auth.OPENAI_API_KEY).toBe('new-key')
      expect(auth.CUSTOM_FIELD).toBe('should-be-preserved')
      expect(fs.existsSync(`${configPath}.bak`)).toBe(false)
      expect(fs.existsSync(`${authPath}.bak`)).toBe(false)
    })

    it('should preserve an existing top-level model_provider when protection is enabled', () => {
      const configPath = getCodexConfigPath()
      const authPath = getCodexAuthPath()
      fs.mkdirSync(path.dirname(configPath), { recursive: true })
      fs.writeFileSync(
        configPath,
        TOML.stringify({
          model_provider: 'StableSlot',
          model_providers: {
            StableSlot: {
              name: 'StableSlot',
              base_url: 'https://old.example.com',
              http_headers: { 'X-Keep': 'preserved' },
              env_key: 'STALE_API_KEY',
            },
            OtherProvider: {
              name: 'OtherProvider',
              base_url: 'https://other.example.com',
            },
          },
        } as any),
        'utf-8'
      )
      fs.writeFileSync(authPath, JSON.stringify({ OPENAI_API_KEY: 'old-key' }), 'utf-8')
      const provider: Provider = {
        id: 'protected-id',
        name: 'NewProvider',
        type: 'codex',
        baseUrl: 'https://new.example.com',
        apiKey: 'new-key',
        createdAt: Date.now(),
      }
      writeCodexConfig(provider)

      const config: any = TOML.parse(fs.readFileSync(configPath, 'utf-8'))
      const auth = JSON.parse(fs.readFileSync(authPath, 'utf-8'))
      expect(config.model_provider).toBe('StableSlot')
      expect(config.model_providers.StableSlot.base_url).toBe(provider.baseUrl)
      expect(config.model_providers.StableSlot.http_headers['X-Keep']).toBe('preserved')
      expect(config.model_providers.StableSlot.env_key).toBeUndefined()
      expect(config.model_providers.NewProvider).toBeUndefined()
      expect(config.model_providers.OtherProvider.base_url).toBe('https://other.example.com')
      expect(auth.OPENAI_API_KEY).toBe(provider.apiKey)
    })

    it('should initialize model_provider when protection is enabled but no name exists', () => {
      const configPath = getCodexConfigPath()
      fs.mkdirSync(path.dirname(configPath), { recursive: true })
      fs.writeFileSync(configPath, TOML.stringify({ custom_field: 'keep' } as any), 'utf-8')
      const provider: Provider = {
        id: 'initialize-id',
        name: 'InitializedProvider',
        type: 'codex',
        baseUrl: 'https://initialized.example.com',
        apiKey: 'new-key',
        createdAt: Date.now(),
      }
      writeCodexConfig(provider)

      const config: any = TOML.parse(fs.readFileSync(configPath, 'utf-8'))
      expect(config.model_provider).toBe('InitializedProvider')
      expect(config.model_providers.InitializedProvider.base_url).toBe(provider.baseUrl)
      expect(config.custom_field).toBe('keep')
    })

    it('should preserve model_provider and create its provider block when the block is missing', () => {
      const configPath = getCodexConfigPath()
      fs.mkdirSync(path.dirname(configPath), { recursive: true })
      fs.writeFileSync(
        configPath,
        TOML.stringify({ model_provider: 'ExistingName', custom_field: 'keep' } as any),
        'utf-8'
      )
      setCodexPreserveProviderName(true)

      const provider: Provider = {
        id: 'missing-block-id',
        name: 'NewProvider',
        type: 'codex',
        baseUrl: 'https://new.example.com',
        apiKey: 'new-key',
        createdAt: Date.now(),
      }
      writeCodexConfig(provider)

      const config: any = TOML.parse(fs.readFileSync(configPath, 'utf-8'))
      expect(config.model_provider).toBe('ExistingName')
      expect(config.model_providers.ExistingName.base_url).toBe(provider.baseUrl)
      expect(config.model_providers.NewProvider).toBeUndefined()
    })

    it('should persist provider-name protection without changing provider storage', () => {
      const storePath = path.join(getAnyAIToolsDir(), 'codex.json')
      fs.mkdirSync(path.dirname(storePath), { recursive: true })
      fs.writeFileSync(
        storePath,
        JSON.stringify({ providers: [{ id: 'keep-me' }], presets: [], custom: 'keep' }),
        'utf-8'
      )

      expect(getCodexSettings().preserveProviderName).toBe(true)
      expect(setCodexPreserveProviderName(true).preserveProviderName).toBe(true)
      expect(getCodexSettings().preserveProviderName).toBe(true)

      const stored = JSON.parse(fs.readFileSync(storePath, 'utf-8'))
      expect(stored.providers).toEqual([{ id: 'keep-me' }])
      expect(stored.custom).toBe('keep')
      expect(stored.settings.preserveProviderName).toBe(true)
    })

    it('should overwrite config.toml and auth.json in overwrite mode', () => {
      const configPath = getCodexConfigPath()
      const authPath = getCodexAuthPath()

      const existingConfig = {
        model_provider: 'OldProvider',
        model: 'some-model',
        custom_field: 'should-be-removed',
        model_providers: {
          OldProvider: {
            name: 'OldProvider',
            base_url: 'https://old.example.com',
          },
        },
      }

      const existingAuth = {
        OPENAI_API_KEY: 'old-key',
        CUSTOM_FIELD: 'should-be-removed',
      }

      fs.mkdirSync(path.dirname(configPath), { recursive: true })
      fs.writeFileSync(configPath, TOML.stringify(existingConfig as any), 'utf-8')
      fs.writeFileSync(authPath, JSON.stringify(existingAuth, null, 2), 'utf-8')

      const provider: Provider = {
        id: 'new-id',
        name: 'NewProvider',
        type: 'codex',
        baseUrl: 'https://new.example.com',
        apiKey: 'new-key',
        createdAt: Date.now(),
      }
      setCodexPreserveProviderName(true)
      writeCodexConfig(provider, { mode: 'overwrite' })

      const configContent = fs.readFileSync(configPath, 'utf-8')
      const config: any = TOML.parse(configContent)

      expect(config.model_provider).toBe('NewProvider')
      expect(config.model_providers.NewProvider.base_url).toBe('https://new.example.com')
      expect(config.custom_field).toBeUndefined()
      expect(config.model_providers.OldProvider).toBeUndefined()

      const authContent = fs.readFileSync(authPath, 'utf-8')
      const auth = JSON.parse(authContent)
      expect(auth.OPENAI_API_KEY).toBe('new-key')
      expect(auth.CUSTOM_FIELD).toBeUndefined()
    })

    it('should fail closed when an existing config.toml cannot be parsed', () => {
      const configPath = getCodexConfigPath()
      const authPath = getCodexAuthPath()
      const invalidConfig = 'model = "unterminated\n'
      const existingAuth = '{"OPENAI_API_KEY":"old-key","CUSTOM_FIELD":"keep-me"}'
      fs.mkdirSync(path.dirname(configPath), { recursive: true })
      fs.writeFileSync(configPath, invalidConfig, 'utf-8')
      fs.writeFileSync(authPath, existingAuth, 'utf-8')

      const provider: Provider = {
        id: 'invalid-config',
        name: 'NewProvider',
        type: 'codex',
        baseUrl: 'https://new.example.com',
        apiKey: 'new-key',
        createdAt: Date.now(),
      }

      expect(() => writeCodexConfig(provider)).toThrow('已中止切换以避免覆盖')
      expect(fs.readFileSync(configPath, 'utf-8')).toBe(invalidConfig)
      expect(fs.readFileSync(authPath, 'utf-8')).toBe(existingAuth)
    })

    it('should fail closed before writing config when auth.json cannot be parsed', () => {
      const configPath = getCodexConfigPath()
      const authPath = getCodexAuthPath()
      const existingConfig = TOML.stringify({ custom_field: 'keep-me' } as any)
      const invalidAuth = '{"OPENAI_API_KEY":'
      fs.mkdirSync(path.dirname(configPath), { recursive: true })
      fs.writeFileSync(configPath, existingConfig, 'utf-8')
      fs.writeFileSync(authPath, invalidAuth, 'utf-8')

      const provider: Provider = {
        id: 'invalid-auth',
        name: 'NewProvider',
        type: 'codex',
        baseUrl: 'https://new.example.com',
        apiKey: 'new-key',
        createdAt: Date.now(),
      }

      expect(() => writeCodexConfig(provider)).toThrow('auth.json')
      expect(fs.readFileSync(configPath, 'utf-8')).toBe(existingConfig)
      expect(fs.readFileSync(authPath, 'utf-8')).toBe(invalidAuth)
    })

    it('should handle baseUrl without trailing slash', () => {
      const provider: Provider = {
        id: 'test',
        name: 'Test',
        type: 'codex',
        baseUrl: 'https://example.com',
        apiKey: 'test-key',
        createdAt: Date.now(),
      }
      writeCodexConfig(provider)

      const content = fs.readFileSync(getCodexConfigPath(), 'utf-8')
      const config: any = TOML.parse(content)

      expect(config.model_providers.Test.base_url).toBe('https://example.com')
    })

    it('should handle baseUrl with trailing slash', () => {
      const provider: Provider = {
        id: 'test',
        name: 'Test',
        type: 'codex',
        baseUrl: 'https://example.com/v1/',
        apiKey: 'test-key',
        createdAt: Date.now(),
      }
      writeCodexConfig(provider)

      const content = fs.readFileSync(getCodexConfigPath(), 'utf-8')
      const config: any = TOML.parse(content)

      expect(config.model_providers.Test.base_url).toBe('https://example.com/v1/')
    })

    it('should create parent directory if not exists', () => {
      const codexPath = getCodexConfigPath()
      const parentDir = path.dirname(codexPath)

      // 确保父目录不存在
      if (fs.existsSync(parentDir)) {
        fs.rmSync(parentDir, { recursive: true })
      }

      const provider: Provider = {
        id: 'test',
        name: 'Test',
        type: 'codex',
        baseUrl: 'https://example.com',
        apiKey: 'test-key',
        createdAt: Date.now(),
      }
      writeCodexConfig(provider)

      expect(fs.existsSync(parentDir)).toBe(true)
      expect(fileExists(codexPath)).toBe(true)
      expect(fileExists(getCodexAuthPath())).toBe(true)
    })
  })
})
