import { describe, expect, it } from 'vitest'
import type { Provider } from '../tool-manager.types.js'
import { decryptProviders, encryptProviders } from './crypto.js'

function createProvider(apiKey: string): Provider {
  return {
    id: 'grok-provider',
    name: 'Grok OAuth',
    baseUrl: 'https://api.example.test/v1',
    apiKey,
    model: 'grok-build',
    apiBackend: 'responses',
    supportsBackendSearch: true,
    createdAt: Date.now(),
    lastModified: Date.now(),
  }
}

describe('provider sync encryption', () => {
  it('keeps an empty API key unchanged for OAuth and environment authentication', () => {
    const provider = createProvider('')

    const encrypted = encryptProviders([provider], 'sync-password')
    expect(encrypted[0]).toEqual(provider)
    expect(decryptProviders(encrypted, 'sync-password')).toEqual([provider])
  })

  it('encrypts non-empty keys while preserving Grok provider metadata', () => {
    const provider = createProvider('sk-sensitive')

    const encrypted = encryptProviders([provider], 'sync-password')
    expect(encrypted[0].apiKey).not.toBe(provider.apiKey)
    expect(encrypted[0]).toMatchObject({
      model: 'grok-build',
      apiBackend: 'responses',
      supportsBackendSearch: true,
    })
    expect(decryptProviders(encrypted, 'sync-password')).toEqual([provider])
  })
})
