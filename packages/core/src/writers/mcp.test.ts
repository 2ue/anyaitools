import { beforeEach, describe, expect, it } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { parse as parseToml } from '@iarna/toml'
import { createMCPManager } from '../tool-manager.js'
import {
  __setTestPaths,
  getClaudeConfigPath,
  getCodexConfigPath,
  getGeminiSettingsPath,
} from '../paths.js'
import {
  addMCPServer,
  exportMCPJson,
  getMCPConfigPath,
  importMCPJson,
  listMCPToolCapabilities,
  loadMCPConfig,
  parseMCPJson,
  toggleMCPForApp,
  validateMCPJson,
} from './mcp.js'

describe('MCP writer', () => {
  beforeEach(() => {
    const testDir = path.join(
      os.tmpdir(),
      `anyaitools-mcp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )
    __setTestPaths({
      anyaitools: path.join(testDir, '.anyaitools'),
      claude: path.join(testDir, '.claude'),
      codex: path.join(testDir, '.codex'),
      gemini: path.join(testDir, '.gemini'),
    })
    fs.rmSync(testDir, { recursive: true, force: true })
  })

  it('removes the old application key when a managed server is renamed', () => {
    const manager = createMCPManager()
    const server = manager.add({
      name: 'old-server-name',
      baseUrl: 'npx',
      apiKey: '-y @example/mcp-server',
    })

    let claudeConfig = JSON.parse(fs.readFileSync(getClaudeConfigPath(), 'utf-8'))
    expect(claudeConfig.mcpServers['old-server-name']).toBeDefined()

    manager.edit(server.id, { name: 'new-server-name' })

    claudeConfig = JSON.parse(fs.readFileSync(getClaudeConfigPath(), 'utf-8'))
    expect(claudeConfig.mcpServers['old-server-name']).toBeUndefined()
    expect(claudeConfig.mcpServers['new-server-name']).toMatchObject({
      command: 'npx',
      args: ['-y', '@example/mcp-server'],
    })
    expect(loadMCPConfig().managedServerNames.claude).toEqual(['new-server-name'])
  })

  it('removes an application key when a managed server is deleted', () => {
    const manager = createMCPManager()
    const server = manager.add({
      name: 'server-to-delete',
      baseUrl: 'npx',
      apiKey: '-y @example/mcp-server',
    })

    expect(
      JSON.parse(fs.readFileSync(getClaudeConfigPath(), 'utf-8')).mcpServers['server-to-delete']
    ).toBeDefined()

    manager.remove(server.id)

    const claudeConfig = JSON.parse(fs.readFileSync(getClaudeConfigPath(), 'utf-8'))
    expect(claudeConfig.mcpServers['server-to-delete']).toBeUndefined()
    expect(loadMCPConfig().managedServerNames.claude).toEqual([])
  })

  it('removes an application key when a server is disabled for that app', () => {
    const manager = createMCPManager()
    const server = manager.add({
      name: 'server-to-disable',
      baseUrl: 'npx',
      apiKey: '-y @example/mcp-server',
    })

    toggleMCPForApp(server.id, 'claude', false)

    const claudeConfig = JSON.parse(fs.readFileSync(getClaudeConfigPath(), 'utf-8'))
    expect(claudeConfig.mcpServers['server-to-disable']).toBeUndefined()
    expect(loadMCPConfig().managedServerNames.claude).toEqual([])
  })

  it('keeps Codex managed names canonical because Codex has no MCP writer', () => {
    const manager = createMCPManager()
    const server = manager.add({
      name: 'codex-mcp-server',
      baseUrl: 'npx',
      apiKey: '-y @example/mcp-server',
    })

    toggleMCPForApp(server.id, 'codex', true)
    manager.edit(server.id, { name: 'renamed-codex-mcp-server' })

    expect(loadMCPConfig().managedServerNames.codex).toEqual(['renamed-codex-mcp-server'])
  })

  it('writes canonical stdio MCP entries to Codex TOML and Gemini JSON', () => {
    const server = addMCPServer({
      name: 'context7',
      transport: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@upstash/context7-mcp'],
        env: { TOKEN: 'secret' },
      },
      enabledTools: { codex: true, gemini: true },
    })

    const codex = parseToml(fs.readFileSync(getCodexConfigPath(), 'utf-8')) as any
    expect(codex.mcp_servers.context7).toMatchObject({
      command: 'npx',
      args: ['-y', '@upstash/context7-mcp'],
      env: { TOKEN: 'secret' },
    })
    const gemini = JSON.parse(fs.readFileSync(getGeminiSettingsPath(), 'utf-8'))
    expect(gemini.mcpServers.context7).toMatchObject({
      command: 'npx',
      args: ['-y', '@upstash/context7-mcp'],
    })
    expect(server.enabledTools.codex).toBe(true)
  })

  it('maps remote transports to each native adapter format', () => {
    addMCPServer({
      name: 'remote-http',
      transport: {
        type: 'streamable-http',
        url: 'https://example.test/mcp',
        headers: { Authorization: 'Bearer secret' },
      },
      enabledTools: { claude: true, codex: true, gemini: true },
    })

    const claude = JSON.parse(fs.readFileSync(getClaudeConfigPath(), 'utf-8'))
    expect(claude.mcpServers['remote-http']).toMatchObject({
      type: 'http',
      url: 'https://example.test/mcp',
      headers: { Authorization: 'Bearer secret' },
    })
    const codex = parseToml(fs.readFileSync(getCodexConfigPath(), 'utf-8')) as any
    expect(codex.mcp_servers['remote-http']).toMatchObject({
      url: 'https://example.test/mcp',
      http_headers: { Authorization: 'Bearer secret' },
    })
    const gemini = JSON.parse(fs.readFileSync(getGeminiSettingsPath(), 'utf-8'))
    expect(gemini.mcpServers['remote-http']).toMatchObject({
      httpUrl: 'https://example.test/mcp',
      headers: { Authorization: 'Bearer secret' },
    })
  })

  it('imports common MCP JSON shapes and applies duplicate strategy', () => {
    const parsed = parseMCPJson(
      JSON.stringify({
        mcpServers: {
          remote: { httpUrl: 'https://example.test/mcp', headers: { Authorization: 'Bearer x' } },
        },
      })
    )
    expect(parsed.servers[0].transport).toEqual({
      type: 'streamable-http',
      url: 'https://example.test/mcp',
      headers: { Authorization: 'Bearer x' },
    })
    expect(validateMCPJson(JSON.stringify({ mcpServers: {} })).valid).toBe(true)

    importMCPJson({ servers: parsed.servers })
    importMCPJson(
      {
        servers: [
          {
            name: 'remote',
            transport: { type: 'sse', url: 'https://example.test/sse' },
            enabledTools: { claude: true },
          },
        ],
      },
      { duplicateStrategy: 'rename' }
    )
    const names = loadMCPConfig().servers.map((server) => server.name)
    expect(names).toEqual(['remote', 'remote-2'])
    expect(JSON.parse(exportMCPJson()).servers).toHaveLength(2)
  })

  it('exposes unsupported tools without allowing writes', () => {
    const opencode = listMCPToolCapabilities().find((item) => item.tool === 'opencode')
    expect(opencode?.supported).toBe(false)
    const server = addMCPServer({
      name: 'unsupported',
      transport: { type: 'stdio', command: 'node', args: ['server.js'] },
      enabledTools: { claude: true },
    })
    expect(() => toggleMCPForApp(server.id, 'opencode', true)).toThrow('不支持')
  })

  it('keeps supported tools separate from enabled tools', () => {
    const server = addMCPServer({
      name: 'codex-only',
      transport: { type: 'stdio', command: 'node', args: ['server.js'] },
      supportedTools: ['codex'],
    })

    expect(server.supportedTools).toEqual(['codex'])
    expect(server.enabledTools).toEqual({})
    expect(() => toggleMCPForApp(server.id, 'claude', true)).toThrow('未声明支持')

    toggleMCPForApp(server.id, 'codex', true)
    expect(loadMCPConfig().servers[0].enabledTools).toEqual({ codex: true })
    expect(parseToml(fs.readFileSync(getCodexConfigPath(), 'utf-8'))).toMatchObject({
      mcp_servers: { 'codex-only': { command: 'node' } },
    })
  })

  it('does not turn registry supportedTools into enabled switches', () => {
    const result = importMCPJson({
      servers: [
        {
          name: 'registry-server',
          transport: { type: 'stdio', command: 'node', args: ['server.js'] },
          supportedTools: ['claude', 'gemini'],
        },
      ],
    })

    expect(result.added[0].supportedTools).toEqual(['claude', 'gemini'])
    expect(result.added[0].enabledTools).toEqual({})
    expect(loadMCPConfig().servers[0].enabledTools).toEqual({})
  })

  it('filters disabled servers from exports unless explicitly requested', () => {
    addMCPServer({
      name: 'enabled-server',
      transport: { type: 'stdio', command: 'node', args: [] },
      enabledTools: { claude: true },
    })
    addMCPServer({
      name: 'disabled-server',
      transport: { type: 'stdio', command: 'node', args: [] },
      enabledTools: {},
    })

    expect(JSON.parse(exportMCPJson()).servers.map((server: any) => server.name)).toEqual([
      'enabled-server',
    ])
    expect(
      JSON.parse(exportMCPJson({ includeDisabled: true })).servers.map((server: any) => server.name)
    ).toEqual(['enabled-server', 'disabled-server'])
    expect(JSON.parse(exportMCPJson({ tools: ['codex'] })).servers).toHaveLength(0)
  })

  it('migrates the legacy command/args/enabledApps shape', () => {
    fs.mkdirSync(path.dirname(getMCPConfigPath()), { recursive: true })
    fs.writeFileSync(
      getMCPConfigPath(),
      JSON.stringify({
        servers: [
          {
            id: 'legacy',
            name: 'legacy',
            command: 'node',
            args: ['server.js'],
            enabledApps: ['claude', 'gemini'],
            createdAt: 1,
            lastModified: 1,
          },
        ],
        managedServerNames: ['legacy'],
      })
    )
    const config = loadMCPConfig()
    expect(config.schemaVersion).toBe(2)
    expect(config.servers[0].transport).toEqual({
      type: 'stdio',
      command: 'node',
      args: ['server.js'],
    })
    expect(config.servers[0].enabledTools).toMatchObject({ claude: true, gemini: true })
  })
})
