import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { __setTestPaths } from './paths.js'
import { fetchModelCatalog } from './model-catalog.js'

describe('model catalog', () => {
  let testDir: string

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anyaitools-model-catalog-'))
    __setTestPaths({
      anyaitools: path.join(testDir, '.anyaitools'),
    })
    vi.restoreAllMocks()
  })

  it('uses provider models and strips sensitive fields before caching', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: 'model-a',
                displayName: 'Model A',
                apiKey: 'should-not-be-cached',
                capabilities: {
                  authorization: 'Bearer should-not-be-cached',
                  input: ['text'],
                },
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      })
    )

    const catalog = await fetchModelCatalog({
      tool: 'codex',
      refresh: true,
      provider: {
        id: 'provider-a',
        name: 'Provider A',
        baseUrl: 'https://example.test/v1',
        apiKey: 'secret-api-key',
        model: 'model-a',
      },
    })

    expect(catalog.models[0]?.id).toBe('model-a')
    expect(catalog.models[0]?.capabilities?.apiKey).toBeUndefined()
    expect(catalog.models[0]?.capabilities?.capabilities).toEqual({ input: ['text'] })

    const cacheContent = fs.readFileSync(
      path.join(testDir, '.anyaitools', 'model-catalogs.json'),
      'utf-8'
    )
    expect(cacheContent).not.toContain('secret-api-key')
    expect(cacheContent).not.toContain('should-not-be-cached')
  })
})
