import { describe, expect, it } from 'vitest'
import type { Provider } from '../tool-manager.types.js'
import { isProviderEqual, mergePresets, mergeProviders } from './merge-advanced.js'

function createProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: 'provider-a',
    name: 'Provider A',
    baseUrl: 'https://api.example.test/v1',
    apiKey: 'sk-test',
    model: 'model-a',
    apiBackend: 'responses',
    supportsBackendSearch: true,
    createdAt: 1,
    lastModified: 1,
    ...overrides,
  }
}

describe('advanced merge Grok metadata', () => {
  it('treats model, backend, and backend search as provider configuration identity', () => {
    const local = createProvider()
    const variants = [
      createProvider({ id: 'model-b', model: 'model-b' }),
      createProvider({ id: 'messages', apiBackend: 'messages' }),
      createProvider({ id: 'no-search', supportsBackendSearch: false }),
    ]

    for (const remote of variants) {
      expect(isProviderEqual(local, remote)).toBe(false)
      const result = mergeProviders([local], [remote])
      expect(result.hasChanges).toBe(true)
      expect(result.merged).toHaveLength(2)
    }
  })

  it('retains presets that share a URL but differ by Grok model capabilities', () => {
    const local = {
      name: 'Grok',
      baseUrl: 'https://api.example.test/v1',
      description: 'Local',
      model: 'model-a',
      apiBackend: 'responses' as const,
      supportsBackendSearch: true,
    }
    const remote = {
      ...local,
      description: 'Remote variant',
      model: 'model-b',
    }

    const merged = mergePresets([local], [remote])
    expect(merged).toHaveLength(2)
    expect(merged.map((preset) => preset.model)).toEqual(['model-a', 'model-b'])
    expect(merged[1]).toMatchObject({
      apiBackend: 'responses',
      supportsBackendSearch: true,
    })
  })

  it('uses the remote preset for an identical Grok configuration', () => {
    const local = {
      name: 'Local',
      baseUrl: 'https://api.example.test/v1',
      description: 'Local description',
      model: 'model-a',
      apiBackend: 'messages' as const,
      supportsBackendSearch: false,
    }
    const remote = { ...local, name: 'Remote', description: 'Remote description' }

    expect(mergePresets([local], [remote])).toEqual([remote])
  })
})
