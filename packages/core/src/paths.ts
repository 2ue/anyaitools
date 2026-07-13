import * as os from 'os'
import * as path from 'path'

const isDev = process.env.NODE_ENV === 'development'
const isTest = process.env.NODE_ENV === 'test'

// 根据环境确定根目录（避免重复判断）
let rootDir: string
if (isTest) {
  // 测试环境：使用固定临时目录，保留历史测试数据
  rootDir = path.join('/tmp', 'anyaitools-test')
} else if (isDev) {
  // 开发环境：使用临时目录（共享）
  rootDir = path.join(os.tmpdir(), 'anyaitools-dev')
} else {
  // 生产环境：使用用户主目录
  rootDir = os.homedir()
}

// 所有路径基于 rootDir（统一逻辑）
let anyaitoolsDir: string = path.join(rootDir, '.anyaitools')
let codexDir: string = path.join(rootDir, '.codex')
let claudeDir: string = path.join(rootDir, '.claude')
const geminiDir: string = path.join(rootDir, '.gemini')
let opencodeDir: string = path.join(rootDir, '.config', 'opencode')
let openclawDir: string = path.join(rootDir, '.openclaw')
const configuredGrokHome = process.env.GROK_HOME?.trim()
let grokDir: string = configuredGrokHome
  ? path.resolve(configuredGrokHome)
  : path.join(rootDir, '.grok')

/**
 * 获取 anyaitools 配置目录
 */
export function getAnyAIToolsDir(): string {
  return anyaitoolsDir
}

/**
 * 获取 Codex 配置目录
 */
export function getCodexDir(): string {
  return codexDir
}

/**
 * 获取 Claude Code 配置目录
 */
export function getClaudeDir(): string {
  return claudeDir
}

/**
 * 获取 Gemini CLI 配置目录
 */
export function getGeminiDir(): string {
  return geminiDir
}

/**
 * 获取 OpenCode 配置目录
 */
export function getOpenCodeDir(): string {
  return opencodeDir
}

/**
 * 获取 OpenClaw 配置目录
 */
export function getOpenClawDir(): string {
  return openclawDir
}

/**
 * 获取 Grok CLI 用户配置目录（优先使用 GROK_HOME）
 */
export function getGrokDir(): string {
  return grokDir
}

/**
 * 获取 anyaitools 配置文件路径
 */
export function getConfigPath(): string {
  return path.join(anyaitoolsDir, 'config.json')
}

/**
 * 获取 anyaitools presets 文件路径（用户自定义）
 */
export function getPresetsPath(): string {
  return path.join(anyaitoolsDir, 'presets.json')
}

/**
 * 获取 anyaitools 默认 presets 文件路径（内置）
 */
export function getDefaultPresetsPath(): string {
  return path.join(anyaitoolsDir, 'presets.default.json')
}

/**
 * 获取 Codex 配置文件路径
 */
export function getCodexConfigPath(): string {
  return path.join(codexDir, 'config.toml')
}

/**
 * 获取 Codex auth.json 文件路径
 */
export function getCodexAuthPath(): string {
  return path.join(codexDir, 'auth.json')
}

/**
 * 获取 Claude Code 配置文件路径
 */
export function getClaudeConfigPath(): string {
  return path.join(claudeDir, 'settings.json')
}

/**
 * 获取 Claude Code 历史记录文件路径 (~/.claude.json)
 * 注意：这是一个独立文件，不在 ~/.claude/ 目录下
 */
export function getClaudeJsonPath(): string {
  return path.join(rootDir, '.claude.json')
}

/**
 * 获取 Gemini CLI 用户配置文件路径 (~/.gemini/settings.json)
 */
export function getGeminiSettingsPath(): string {
  return path.join(geminiDir, 'settings.json')
}

/**
 * 获取 Gemini CLI 环境变量文件路径 (~/.gemini/.env)
 */
export function getGeminiEnvPath(): string {
  return path.join(geminiDir, '.env')
}

/**
 * 获取 OpenCode 配置文件路径 (~/.config/opencode/opencode.json)
 */
export function getOpenCodeConfigPath(): string {
  return path.join(opencodeDir, 'opencode.json')
}

/**
 * 获取 OpenClaw 主配置文件路径 (~/.openclaw/openclaw.json)
 */
export function getOpenClawConfigPath(): string {
  return path.join(openclawDir, 'openclaw.json')
}

/**
 * 获取 OpenClaw models 配置文件路径 (~/.openclaw/agents/main/agent/models.json)
 */
export function getOpenClawModelsPath(): string {
  return path.join(openclawDir, 'agents', 'main', 'agent', 'models.json')
}

/**
 * 获取 Grok CLI 用户配置文件路径（$GROK_HOME/config.toml）
 */
export function getGrokConfigPath(): string {
  return path.join(grokDir, 'config.toml')
}

/**
 * 测试专用 API：设置自定义路径
 * 仅在测试环境可用，用于精确控制测试路径
 */
export function __setTestPaths(paths: {
  anyaitools?: string
  codex?: string
  claude?: string
  opencode?: string
  openclaw?: string
  grok?: string
}): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('__setTestPaths can only be used in test environment')
  }
  if (paths.anyaitools) anyaitoolsDir = paths.anyaitools
  if (paths.codex) codexDir = paths.codex
  if (paths.claude) claudeDir = paths.claude
  if (paths.opencode) opencodeDir = paths.opencode
  if (paths.openclaw) openclawDir = paths.openclaw
  if (paths.grok) grokDir = paths.grok
}
