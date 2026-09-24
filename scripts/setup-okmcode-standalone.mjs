#!/usr/bin/env node
/**
 * okmcode 快速配置脚本（独立版本，不依赖 anyaitools）
 *
 * 功能：直接修改 Claude Code、Codex、Gemini CLI、OpenCode 的配置文件
 *
 * 用法：
 *   node scripts/setup-okmcode-standalone.mjs                    # 交互式输入（快捷覆盖模式）
 *   node scripts/setup-okmcode-standalone.mjs sk-ant-xxx         # 直接传入 API Key（快捷覆盖模式）
 *   node scripts/setup-okmcode-standalone.mjs --overwrite        # 兼容旧参数（行为不变）
 *   node scripts/setup-okmcode-standalone.mjs sk-ant-xxx --overwrite  # 兼容旧参数（行为不变）
 *
 * 策略说明：
 *   - 快捷配置入口统一采用覆盖写入：直接落下托管配置
 *   - 已存在的目标配置文件写入前会备份为 .bak
 *
 * 依赖：零依赖，只使用 Node.js 内置 API
 */

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

const OKMCODE_BASE_URLS = {
  claude: 'https://okmcode.com',
  codex: 'https://okmcode.com',
  gemini: 'https://okmcode.com',
  opencode: 'https://okmcode.com',
}
const HOME_DIR = os.homedir()

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 确保目录存在
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 })
  }
}

/**
 * 原子性写入文件
 */
function atomicWrite(filePath, content, mode = 0o600) {
  const tempPath = `${filePath}.tmp`
  fs.writeFileSync(tempPath, content, { mode })
  fs.renameSync(tempPath, filePath)
}

function backupFileIfExists(filePath, operation) {
  if (!fs.existsSync(filePath)) return null

  const backupPath = `${filePath}.bak`
  try {
    fs.copyFileSync(filePath, backupPath)
    fs.chmodSync(backupPath, 0o600)
    return backupPath
  } catch (error) {
    throw new Error(`备份失败，已中止后续写入（${operation}）: ${error.message}`)
  }
}

// ============================================================================
// Claude Code 配置
// ============================================================================

function configureClaudeCode(apiKey) {
  const configDir = path.join(HOME_DIR, '.claude')
  const configPath = path.join(configDir, 'settings.json')

  ensureDir(configDir)

  // 默认配置
  const defaultConfig = {
    model: 'sonnet',
    env: {
      ANTHROPIC_AUTH_TOKEN: apiKey,
      ANTHROPIC_BASE_URL: OKMCODE_BASE_URLS.claude,
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: 1,
      CLAUDE_CODE_MAX_OUTPUT_TOKENS: 32000,
    },
    permissions: {
      allow: [],
      deny: [],
    },
    alwaysThinkingEnabled: true,
  }

  backupFileIfExists(configPath, 'standalone.claude.settings.json')
  atomicWrite(configPath, JSON.stringify(defaultConfig, null, 2))
}

// ============================================================================
// Codex 配置
// ============================================================================

function configureCodex(apiKey) {
  const configDir = path.join(HOME_DIR, '.codex')
  const configPath = path.join(configDir, 'config.toml')
  const authPath = path.join(configDir, 'auth.json')
  const providerKey = 'okmcode'

  ensureDir(configDir)

  // 1. 处理 config.toml（先备份，再覆盖写入）
  const minimalConfig = [
    `model_provider = "${providerKey}"`,
    'model = "gpt-5.5"',
    'review_model = "gpt-5.5"',
    'model_reasoning_effort = "xhigh"',
    'plan_mode_reasoning_effort = "xhigh"',
    'model_reasoning_summary = "auto"',
    'model_verbosity = "high"',
    'personality = "pragmatic"',
    'sandbox_mode = "danger-full-access"',
    'approval_policy = "never"',
    'web_search = "cached"',
    '',
    '[windows]',
    'sandbox = "elevated"',
    '',
    '[features]',
    'multi_agent = true',
    'shell_tool = true',
    'shell_snapshot = true',
    'fast_mode = true',
    'personality = true',
    '',
    `[model_providers.${providerKey}]`,
    `name = "${providerKey}"`,
    `base_url = "${OKMCODE_BASE_URLS.codex}"`,
    'wire_api = "responses"',
    'requires_openai_auth = true',
    '',
  ].join('\n')

  backupFileIfExists(configPath, 'standalone.codex.config.toml')

  atomicWrite(configPath, minimalConfig)

  // 2. 处理 auth.json（先备份，再覆盖写入，仅保留 OPENAI_API_KEY）
  backupFileIfExists(authPath, 'standalone.codex.auth.json')

  const auth = { OPENAI_API_KEY: apiKey }
  atomicWrite(authPath, JSON.stringify(auth, null, 2))
}

// ============================================================================
// Gemini CLI 配置
// ============================================================================

function configureGeminiCLI(apiKey) {
  const configDir = path.join(HOME_DIR, '.gemini')
  const settingsPath = path.join(configDir, 'settings.json')
  const envPath = path.join(configDir, '.env')

  ensureDir(configDir)

  // 1. 处理 settings.json
  const settings = {
    ide: {
      enabled: true,
    },
    security: {
      auth: {
        selectedType: 'gemini-api-key',
      },
    },
  }

  backupFileIfExists(settingsPath, 'standalone.gemini.settings.json')
  atomicWrite(settingsPath, JSON.stringify(settings, null, 2))

  // 2. 处理 .env
  const env = {
    GEMINI_API_KEY: apiKey,
    GEMINI_MODEL: 'gemini-3.5-flash',
    GOOGLE_GEMINI_BASE_URL: OKMCODE_BASE_URLS.gemini,
  }

  // 写入 .env（按 KEY 排序）
  const lines = Object.keys(env)
    .sort()
    .map((key) => `${key}=${env[key]}`)
  backupFileIfExists(envPath, 'standalone.gemini.env')
  atomicWrite(envPath, lines.join('\n') + '\n')
}

// ============================================================================
// OpenCode 配置
// ============================================================================

function configureOpenCode(apiKey) {
  const configDir = path.join(HOME_DIR, '.config', 'opencode')
  const configPath = path.join(configDir, 'opencode.json')

  ensureDir(configDir)

  // 构建 okmcode provider 配置
  const okmcodeProvider = {
    npm: '@ai-sdk/openai',
    name: 'okmcode',
    options: {
      baseURL: OKMCODE_BASE_URLS.opencode,
      apiKey: apiKey,
    },
    models: {
      'gpt-5.5': {
        options: {
          store: false,
        },
        variants: {
          xhigh: {
            reasoningEffort: 'xhigh',
            textVerbosity: 'low',
            reasoningSummary: 'auto',
          },
          high: {
            reasoningEffort: 'high',
            textVerbosity: 'low',
            reasoningSummary: 'auto',
          },
          medium: {
            reasoningEffort: 'medium',
            textVerbosity: 'low',
            reasoningSummary: 'auto',
          },
          low: {
            reasoningEffort: 'low',
            textVerbosity: 'low',
            reasoningSummary: 'auto',
          },
        },
      },
    },
  }

  const config = {
    $schema: 'https://opencode.ai/config.json',
    model: 'okmcode/gpt-5.5',
    agent: {
      build: { options: { store: false } },
      plan: { options: { store: false } },
    },
    provider: {
      okmcode: okmcodeProvider,
    },
  }

  backupFileIfExists(configPath, 'standalone.opencode.opencode.json')
  atomicWrite(configPath, JSON.stringify(config, null, 2))
}

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  console.log('🚀 okmcode 快速配置工具（独立版本）\n')

  // 1. 解析命令行参数
  const args = process.argv.slice(2)
  let apiKey = null

  for (const arg of args) {
    if (arg === '--overwrite') {
      // 兼容旧参数；当前快捷入口默认即覆盖写入。
    } else if (!arg.startsWith('--')) {
      apiKey = arg
    }
  }

  // 2. 获取 API Key
  if (!apiKey) {
    const rl = createInterface({ input: stdin, output: stdout })
    apiKey = await rl.question('请输入 okmcode API Key: ')
    rl.close()
  }

  if (!apiKey?.trim()) {
    throw new Error('API Key 不能为空')
  }

  // 3. 显示快捷写入信息
  console.log('⚠️  快捷覆盖模式：将直接覆盖托管配置，并在写入前备份已有目标文件')

  console.log('\n开始配置...\n')

  // 4. 配置所有工具
  const tools = [
    { name: 'Claude Code', configure: configureClaudeCode },
    { name: 'Codex', configure: configureCodex },
    { name: 'Gemini CLI', configure: configureGeminiCLI },
    { name: 'OpenCode', configure: configureOpenCode },
  ]

  for (const { name, configure } of tools) {
    try {
      configure(apiKey)
      console.log(`✅ ${name}`)
    } catch (error) {
      console.error(`❌ ${name}: ${error.message}`)
    }
  }

  console.log('\n🎉 okmcode 配置完成！')
  console.log('\n配置文件位置：')
  console.log(`  - Claude Code: ${path.join(HOME_DIR, '.claude/settings.json')}`)
  console.log(`  - Codex:       ${path.join(HOME_DIR, '.codex/config.toml')}`)
  console.log(`  - Codex:       ${path.join(HOME_DIR, '.codex/auth.json')}`)
  console.log(`  - Gemini CLI:  ${path.join(HOME_DIR, '.gemini/settings.json')}`)
  console.log(`  - Gemini CLI:  ${path.join(HOME_DIR, '.gemini/.env')}`)
  console.log(`  - OpenCode:    ${path.join(HOME_DIR, '.config/opencode/opencode.json')}`)
  console.log('\n提示：请重启对应的工具以使配置生效。')
}

main().catch((err) => {
  console.error(`\n❌ 错误: ${err.message}`)
  process.exit(1)
})
