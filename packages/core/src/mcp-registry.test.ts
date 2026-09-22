import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { __setTestPaths, getMCPRegistryCachePath, getMCPRegistrySourcesPath } from './paths.js'
import {
  addMCPRegistrySource,
  getCachedMCPRegistrySnapshots,
  listBuiltInMCPRegistrySources,
  loadMCPRegistrySources,
  refreshMCPRegistrySource,
  searchMCPRegistry,
} from './mcp-registry.js'

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  }
}

describe('MCP registry', () => {
  let testDir: string

  beforeEach(() => {
    testDir = path.join(
      os.tmpdir(),
      `anyaitools-registry-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )
    __setTestPaths({ anyaitools: path.join(testDir, '.anyaitools') })
    fs.rmSync(testDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('exposes the built-in official and community sources', () => {
    const sources = listBuiltInMCPRegistrySources()
    expect(sources.map((source) => source.id)).toEqual([
      'official-mcp-registry',
      'official-reference-servers',
      'tensorblock-community-catalog',
    ])
    expect(sources.every((source) => source.builtIn && source.enabled)).toBe(true)
  })

  it('persists custom sources and rejects insecure URLs', () => {
    expect(() =>
      addMCPRegistrySource({
        name: 'insecure',
        kind: 'json',
        url: 'http://example.com/registry.json',
      })
    ).toThrow('只允许 HTTPS')

    const source = addMCPRegistrySource({
      name: 'local catalog',
      kind: 'json',
      url: 'http://localhost:8787/registry.json',
    })
    expect(loadMCPRegistrySources()).toContainEqual(source)
    expect(JSON.parse(fs.readFileSync(getMCPRegistrySourcesPath(), 'utf8')).sources).toContainEqual(
      source
    )
  })

  it('maps official registry packages and remote transports', async () => {
    const pages = [
      {
        servers: [
          {
            server: {
              name: 'pypi-server',
              packages: [
                { registryType: 'pypi', identifier: 'mcp-pypi', transport: { type: 'stdio' } },
              ],
            },
          },
          {
            server: {
              name: 'docker-server',
              packages: [
                {
                  registryType: 'docker',
                  identifier: 'ghcr.io/example/mcp',
                  transport: { type: 'stdio' },
                },
              ],
            },
          },
        ],
        metadata: { nextCursor: 'page-2' },
      },
      {
        servers: [
          {
            server: {
              name: 'remote-server',
              remotes: [{ type: 'streamable-http', url: 'https://example.test/mcp' }],
            },
          },
        ],
      },
    ]
    const fetchMock = vi.fn(async (url: string) =>
      response(url.includes('cursor=page-2') ? pages[1] : pages[0])
    )
    vi.stubGlobal('fetch', fetchMock)

    const source = addMCPRegistrySource({
      name: 'official test',
      kind: 'official-api',
      url: 'https://registry.example.test/v0/servers?limit=2',
    })
    const snapshot = await refreshMCPRegistrySource(source.id)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(snapshot.entries).toHaveLength(3)
    expect(snapshot.entries[0].server?.transport).toEqual({
      type: 'stdio',
      command: 'uvx',
      args: ['mcp-pypi'],
    })
    expect(snapshot.entries[1].server?.transport).toEqual({
      type: 'stdio',
      command: 'docker',
      args: ['run', '--rm', 'ghcr.io/example/mcp'],
    })
    expect(snapshot.entries[2].server?.transport).toEqual({
      type: 'streamable-http',
      url: 'https://example.test/mcp',
    })
  })

  it('parses community catalogs, including quoted install commands', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        response([
          {
            id: 'remote',
            name: 'Remote catalog server',
            links: {
              endpoint: 'https://example.test/mcp',
              repo: 'https://github.com/example/repo',
            },
          },
          {
            id: 'stdio',
            name: 'Quoted command',
            install: { commands: ['npx -y "@scope/mcp server" --flag "hello world"'] },
          },
          {
            id: 'manual',
            name: 'Manual only',
            links: { repo: 'https://github.com/example/manual' },
          },
        ])
      )
    )

    const source = addMCPRegistrySource({
      name: 'community test',
      kind: 'json',
      parser: 'community-catalog',
      url: 'https://catalog.example.test/catalog.json',
    })
    const snapshot = await refreshMCPRegistrySource(source.id)

    expect(snapshot.entries).toHaveLength(3)
    expect(snapshot.entries[0].server?.transport).toEqual({
      type: 'streamable-http',
      url: 'https://example.test/mcp',
    })
    expect(snapshot.entries[1].server?.transport).toEqual({
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@scope/mcp server', '--flag', 'hello world'],
    })
    expect(snapshot.entries[2].installable).toBe(false)
  })

  it('parses generic servers and mcpServers shapes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        response({
          mcpServers: {
            filesystem: {
              command: 'npx',
              args: ['-y', '@modelcontextprotocol/server-filesystem'],
            },
            remote: { httpUrl: 'https://example.test/mcp' },
          },
        })
      )
    )
    const source = addMCPRegistrySource({
      name: 'generic test',
      kind: 'json',
      url: 'https://catalog.example.test/mcp.json',
    })
    const snapshot = await refreshMCPRegistrySource(source.id)
    expect(snapshot.entries.map((entry) => entry.name)).toEqual(['filesystem', 'remote'])
    expect(snapshot.entries[0].server?.transport.type).toBe('stdio')
    expect(snapshot.entries[1].server?.transport).toEqual({
      type: 'streamable-http',
      url: 'https://example.test/mcp',
    })
  })

  it('parses GitHub README references as non-installable entries', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        response(
          url === 'https://raw.githubusercontent.com/example/repo/main/README.md'
            ? '- **[Demo Server](src/demo)** - Example reference server'
            : ''
        )
      )
    )
    const source = addMCPRegistrySource({
      name: 'github test',
      kind: 'github',
      url: 'https://github.com/example/repo',
    })
    const snapshot = await refreshMCPRegistrySource(source.id)
    expect(snapshot.entries[0]).toMatchObject({
      name: 'Demo Server',
      repository: 'https://github.com/example/repo/src/demo',
      installable: false,
    })
  })

  it('falls back to cached results after a refresh failure', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          servers: [{ name: 'cached', transport: { type: 'stdio', command: 'node', args: [] } }],
        })
      )
      .mockRejectedValueOnce(new Error('network down'))
    vi.stubGlobal('fetch', fetchMock)
    const source = addMCPRegistrySource({
      name: 'cache test',
      kind: 'json',
      url: 'https://catalog.example.test/cache.json',
    })

    const first = await refreshMCPRegistrySource(source.id)
    const second = await refreshMCPRegistrySource(source.id)
    expect(first.entries).toHaveLength(1)
    expect(second.stale).toBe(true)
    expect(second.error).toContain('network down')
    expect(second.entries[0].name).toBe('cached')
    expect(
      getCachedMCPRegistrySnapshots().find((item) => item.source.id === source.id)?.entries
    ).toHaveLength(1)
    expect(fs.existsSync(getMCPRegistryCachePath())).toBe(true)
  })

  it('filters cached entries by query and installability', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        response({
          servers: [
            { name: 'installable', transport: { type: 'stdio', command: 'node', args: [] } },
            { name: 'manual', description: 'manual reference' },
          ],
        })
      )
    )
    const source = addMCPRegistrySource({
      name: 'search test',
      kind: 'json',
      url: 'https://catalog.example.test/search.json',
    })
    await refreshMCPRegistrySource(source.id)
    const result = await searchMCPRegistry({
      sourceIds: [source.id],
      query: 'installable',
      installableOnly: true,
    })
    expect(result[0].entries.map((entry) => entry.name)).toEqual(['installable'])
  })
})
