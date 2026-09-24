import { describe, it, expect, beforeEach } from 'vitest'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import { writeOpenCodeConfig } from './opencode'
import { getOpenCodeConfigPath, __setTestPaths } from '../paths'
import { fileExists } from '../utils/file'

describe('OpenCode Writer', () => {
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
      opencode: path.join(testDir, '.config', 'opencode'),
    })

    // 清理测试文件
    const configPath = getOpenCodeConfigPath()
    if (fileExists(configPath)) {
      fs.unlinkSync(configPath)
    }
  })

  describe('writeOpenCodeConfig', () => {
    it('should create new opencode.json with openai provider and model', () => {
      const now = Date.now()
      const provider = {
        id: 'test-id',
        name: 'okmcode',
        baseUrl: 'https://okmcode.com',
        apiKey: 'test-api-key-123',
        createdAt: now,
        lastModified: now,
      }

      writeOpenCodeConfig(provider)

      const configPath = getOpenCodeConfigPath()
      expect(fileExists(configPath)).toBe(true)

      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

      expect(config.$schema).toBe('https://opencode.ai/config.json')
      expect(config.model).toBe('openai/gpt-5.5')

      expect(config.provider?.openai?.options?.baseURL).toBe(provider.baseUrl)
      expect(config.provider?.openai?.options?.apiKey).toBe(provider.apiKey)

      expect(config.agent?.build?.options?.store).toBe(false)
      expect(config.agent?.plan?.options?.store).toBe(false)

      expect(config.provider?.openai?.models?.['gpt-5.5']?.options?.store).toBe(false)
      expect(config.provider?.openai?.models?.['gpt-5.3-codex']).toBeUndefined()
      const variantKeys = Object.keys(
        config.provider?.openai?.models?.['gpt-5.5']?.variants || {}
      ).sort()
      expect(variantKeys).toEqual(['high', 'low', 'medium', 'xhigh'].sort())
    })

    it('should preserve existing fields and force-update baseURL/apiKey + store flags', () => {
      const configPath = getOpenCodeConfigPath()
      fs.mkdirSync(path.dirname(configPath), { recursive: true })

      fs.writeFileSync(
        configPath,
        JSON.stringify(
          {
            $schema: 'https://opencode.ai/config.json',
            theme: 'my-theme',
            model: 'openai/legacy-model',
            agent: {
              build: { options: { store: true, other: 'keep' } },
              plan: { options: { store: true } },
              customAgentField: { enabled: true },
            },
            provider: {
              openai: {
                options: {
                  baseURL: 'https://old.example.com/v1',
                  apiKey: 'old-key',
                  timeout: 12345,
                },
                models: {
                  'gpt-5.4': {
                    options: { store: true },
                  },
                  'gpt-5.3-codex': {
                    options: { store: true },
                  },
                  'legacy-model': {
                    options: { store: true },
                    variants: { low: { disabled: true } },
                    extra: 'keep',
                  },
                },
              },
              other: { options: { apiKey: 'should-not-change' } },
            },
          },
          null,
          2
        ),
        'utf-8'
      )

      const now = Date.now()
      const provider = {
        id: 'new-id',
        name: 'New Provider',
        baseUrl: 'https://new.example.com/v1',
        apiKey: 'new-key',
        createdAt: now,
        lastModified: now,
      }

      writeOpenCodeConfig(provider)

      const nextConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

      // preserved
      expect(nextConfig.theme).toBe('my-theme')
      expect(nextConfig.provider.other.options.apiKey).toBe('should-not-change')
      expect(nextConfig.provider.openai.options.timeout).toBe(12345)
      expect(nextConfig.provider.openai.models['legacy-model'].variants.low.disabled).toBe(true)
      expect(nextConfig.provider.openai.models['legacy-model'].extra).toBe('keep')
      expect(nextConfig.agent.customAgentField.enabled).toBe(true)

      // forced updates
      expect(nextConfig.model).toBe('openai/gpt-5.5')
      expect(nextConfig.provider.openai.options.baseURL).toBe(provider.baseUrl)
      expect(nextConfig.provider.openai.options.apiKey).toBe(provider.apiKey)
      expect(nextConfig.agent.build.options.store).toBe(false)
      expect(nextConfig.agent.plan.options.store).toBe(false)
      expect(nextConfig.provider.openai.models['gpt-5.5'].options.store).toBe(false)
      expect(nextConfig.provider.openai.models['legacy-model'].options.store).toBe(true)
      expect(nextConfig.provider.openai.models['gpt-5.4']).toBeUndefined()
      expect(nextConfig.provider.openai.models['gpt-5.3-codex']).toBeUndefined()
    })

    it('should overwrite unrelated fields in overwrite mode', () => {
      const configPath = getOpenCodeConfigPath()
      fs.mkdirSync(path.dirname(configPath), { recursive: true })
      fs.writeFileSync(
        configPath,
        JSON.stringify(
          {
            $schema: 'https://opencode.ai/config.json',
            theme: 'remove-me',
            provider: {
              openai: {
                options: {
                  baseURL: 'https://old.example.com',
                  apiKey: 'old-key',
                },
              },
              other: {
                options: {
                  apiKey: 'should-be-removed',
                },
              },
            },
          },
          null,
          2
        ),
        'utf-8'
      )

      const now = Date.now()
      const provider = {
        id: 'overwrite-id',
        name: 'Overwrite Provider',
        baseUrl: 'https://new.example.com/v1',
        apiKey: 'new-key',
        createdAt: now,
        lastModified: now,
      }

      writeOpenCodeConfig(provider, { mode: 'overwrite' })

      const nextConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      expect(nextConfig.theme).toBeUndefined()
      expect(nextConfig.provider.other).toBeUndefined()
      expect(nextConfig.provider.openai.options.baseURL).toBe(provider.baseUrl)
      expect(nextConfig.provider.openai.options.apiKey).toBe(provider.apiKey)
      expect(nextConfig.model).toBe('openai/gpt-5.5')
      expect(nextConfig.provider.openai.models['gpt-5.5'].options.store).toBe(false)
      expect(nextConfig.provider.openai.models['gpt-5.3-codex']).toBeUndefined()
    })

    it('should remove the selected model and agent overrides when clearModel is requested', () => {
      const configPath = getOpenCodeConfigPath()
      fs.mkdirSync(path.dirname(configPath), { recursive: true })
      fs.writeFileSync(
        configPath,
        JSON.stringify(
          {
            $schema: 'https://opencode.ai/config.json',
            model: 'openai/legacy-model',
            agent: {
              build: { model: 'openai/legacy-model#high' },
              plan: { model: 'openai/legacy-model#high' },
            },
            provider: {
              openai: {
                models: {
                  'legacy-model': {
                    variants: { high: {} },
                  },
                },
              },
            },
          },
          null,
          2
        ),
        'utf-8'
      )

      writeOpenCodeConfig(
        {
          id: 'clear-model-id',
          name: 'Clear Model',
          baseUrl: 'https://example.com/v1',
          apiKey: 'test-key',
          model: 'legacy-model',
          modelConfig: {
            modelId: 'legacy-model',
            variant: 'high',
          },
          createdAt: Date.now(),
        },
        { clearModel: true }
      )

      const nextConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      expect(nextConfig.model).toBeUndefined()
      expect(nextConfig.agent.build.model).toBeUndefined()
      expect(nextConfig.agent.plan.model).toBeUndefined()
    })
  })
})
