#!/usr/bin/env node
/**
 * OKMCode 配置脚本测试
 *
 * 测试策略：
 * 1. 使用临时测试目录（不影响正式环境）
 * 2. 测试快捷覆盖模式与写前备份
 * 3. 验证配置文件内容
 * 4. 测试完成后清理
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { execSync } from 'child_process'

// 测试配置
const TEST_API_KEY = 'sk-ant-test-key-123456'
const OKMCODE_BASE_URLS = {
  claude: 'https://okmcode.com',
  codex: 'https://okmcode.com',
  gemini: 'https://okmcode.com',
  opencode: 'https://okmcode.com',
}

// 创建临时测试目录
const TEST_ROOT = path.join(os.tmpdir(), `anyaitools-okmcode-test-${Date.now()}`)
const TEST_HOME = path.join(TEST_ROOT, 'home')

console.log('🧪 OKMCode 配置脚本测试\n')
console.log(`测试目录: ${TEST_ROOT}\n`)

// 确保测试目录存在
fs.mkdirSync(TEST_HOME, { recursive: true })

// ============================================================================
// 工具函数
// ============================================================================

function createTestConfig(tool, config) {
  const configMap = {
    claude: path.join(TEST_HOME, '.claude/settings.json'),
    codex: path.join(TEST_HOME, '.codex/config.toml'),
    'codex-auth': path.join(TEST_HOME, '.codex/auth.json'),
    gemini: path.join(TEST_HOME, '.gemini/settings.json'),
    'gemini-env': path.join(TEST_HOME, '.gemini/.env'),
    opencode: path.join(TEST_HOME, '.config/opencode/opencode.json'),
  }

  const configPath = configMap[tool]
  fs.mkdirSync(path.dirname(configPath), { recursive: true })

  if (tool === 'codex') {
    fs.writeFileSync(configPath, config)
  } else if (tool === 'gemini-env') {
    fs.writeFileSync(configPath, config)
  } else {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
  }
}

function readTestConfig(tool) {
  const configMap = {
    claude: path.join(TEST_HOME, '.claude/settings.json'),
    codex: path.join(TEST_HOME, '.codex/config.toml'),
    'codex-auth': path.join(TEST_HOME, '.codex/auth.json'),
    gemini: path.join(TEST_HOME, '.gemini/settings.json'),
    'gemini-env': path.join(TEST_HOME, '.gemini/.env'),
    opencode: path.join(TEST_HOME, '.config/opencode/opencode.json'),
  }

  const configPath = configMap[tool]
  if (!fs.existsSync(configPath)) {
    return null
  }

  if (tool === 'codex') {
    return fs.readFileSync(configPath, 'utf-8')
  } else if (tool === 'gemini-env') {
    return fs.readFileSync(configPath, 'utf-8')
  } else {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  }
}

function cleanup() {
  if (fs.existsSync(TEST_ROOT)) {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true })
  }
}

function runScript(scriptPath, args = []) {
  const env = { ...process.env, HOME: TEST_HOME }
  const cmd = `node ${scriptPath} ${args.join(' ')}`

  try {
    const output = execSync(cmd, {
      env,
      encoding: 'utf-8',
      stdio: 'pipe',
    })
    return { success: true, output }
  } catch (error) {
    return { success: false, error: error.message, output: error.stdout }
  }
}

// ============================================================================
// 测试用例
// ============================================================================

let passedTests = 0
let failedTests = 0

function test(name, fn) {
  try {
    fn()
    console.log(`✅ ${name}`)
    passedTests++
  } catch (error) {
    console.error(`❌ ${name}`)
    console.error(`   ${error.message}`)
    failedTests++
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

// ============================================================================
// 测试 1: setup-okmcode-standalone.mjs - 快捷覆盖模式（从零开始）
// ============================================================================

console.log('📋 测试 1: 独立脚本 - 快捷覆盖模式（从零开始）\n')

test('应该创建所有配置文件', () => {
  const result = runScript('scripts/setup-okmcode-standalone.mjs', [TEST_API_KEY])
  assert(result.success, '脚本执行失败')

  assert(fs.existsSync(path.join(TEST_HOME, '.claude/settings.json')), 'Claude 配置未创建')
  assert(fs.existsSync(path.join(TEST_HOME, '.codex/config.toml')), 'Codex 配置未创建')
  assert(fs.existsSync(path.join(TEST_HOME, '.codex/auth.json')), 'Codex auth 未创建')
  assert(fs.existsSync(path.join(TEST_HOME, '.gemini/settings.json')), 'Gemini 配置未创建')
  assert(fs.existsSync(path.join(TEST_HOME, '.gemini/.env')), 'Gemini .env 未创建')
  assert(
    fs.existsSync(path.join(TEST_HOME, '.config/opencode/opencode.json')),
    'OpenCode 配置未创建'
  )
})

test('Claude 配置应该包含正确的认证信息', () => {
  const config = readTestConfig('claude')
  assert(config.model === 'sonnet', 'Claude 默认模型不正确')
  assert(config.env.ANTHROPIC_AUTH_TOKEN === TEST_API_KEY, 'API Key 不正确')
  assert(config.env.ANTHROPIC_BASE_URL === OKMCODE_BASE_URLS.claude, 'Base URL 不正确')
  assert(config.alwaysThinkingEnabled === true, 'Claude extended thinking 未启用')
})

test('Codex 配置应该包含 OKMCode provider', () => {
  const config = readTestConfig('codex')
  assert(config.includes('model_provider = "okmcode"'), 'model_provider 不正确')
  assert(config.includes('model = "gpt-5.5"'), 'model 不正确')
  assert(config.includes('review_model = "gpt-5.5"'), 'review_model 不正确')
  assert(config.includes('model_reasoning_effort = "xhigh"'), 'model_reasoning_effort 不正确')
  assert(
    config.includes('plan_mode_reasoning_effort = "xhigh"'),
    'plan_mode_reasoning_effort 不正确'
  )
  assert(config.includes('model_reasoning_summary = "auto"'), 'model_reasoning_summary 不正确')
  assert(config.includes('model_verbosity = "high"'), 'model_verbosity 不正确')
  assert(config.includes('personality = "pragmatic"'), 'personality 不正确')
  assert(config.includes('sandbox_mode = "danger-full-access"'), 'sandbox_mode 不正确')
  assert(config.includes('approval_policy = "never"'), 'approval_policy 不正确')
  assert(config.includes('web_search = "cached"'), 'web_search 不正确')
  assert(config.includes('[windows]'), 'Windows 配置块不存在')
  assert(config.includes('sandbox = "elevated"'), 'Windows sandbox 不正确')
  assert(config.includes('[features]'), 'features 配置块不存在')
  assert(config.includes('multi_agent = true'), 'multi_agent 未启用')
  assert(config.includes('shell_tool = true'), 'shell_tool 未启用')
  assert(config.includes('shell_snapshot = true'), 'shell_snapshot 未启用')
  assert(config.includes('fast_mode = true'), 'fast_mode 未启用')
  assert(!config.includes('apply_patch_freeform'), '不应写入已移除的 apply_patch_freeform')
  assert(!config.includes('elevated_windows_sandbox'), '不应写入旧 Windows sandbox feature')
  assert(!config.includes('profile ='), '不应写入旧 profile')
  assert(!config.includes('[profiles.'), '不应写入旧 profiles 表')
  assert(config.includes('[model_providers.okmcode]'), 'okmcode provider 块不存在')
  assert(config.includes(OKMCODE_BASE_URLS.codex), 'Base URL 不存在')
})

test('Codex auth.json 应该包含 API Key', () => {
  const auth = readTestConfig('codex-auth')
  assert(auth.OPENAI_API_KEY === TEST_API_KEY, 'API Key 不正确')
})

test('Gemini 配置应该启用 IDE', () => {
  const config = readTestConfig('gemini')
  assert(config.ide.enabled === true, 'IDE 未启用')
})

test('Gemini .env 应该包含认证信息', () => {
  const env = readTestConfig('gemini-env')
  assert(env.includes(`GEMINI_API_KEY=${TEST_API_KEY}`), 'API Key 不存在')
  assert(env.includes(`GOOGLE_GEMINI_BASE_URL=${OKMCODE_BASE_URLS.gemini}`), 'Base URL 不存在')
  assert(env.includes('GEMINI_MODEL=gemini-3.5-flash'), 'Gemini 默认模型不正确')
})

test('OpenCode 配置应该包含 OKMCode provider', () => {
  const config = readTestConfig('opencode')
  assert(config.model === 'okmcode/gpt-5.5', 'OpenCode 默认模型不正确')
  assert(config.provider.okmcode.name === 'OKMCode', 'Provider 名称不正确')
  assert(config.provider.okmcode.options.apiKey === TEST_API_KEY, 'API Key 不正确')
  assert(config.provider.okmcode.options.baseURL === OKMCODE_BASE_URLS.opencode, 'Base URL 不正确')
  assert(config.provider.okmcode.models['gpt-5.5'].options.store === false, '模型 store 不正确')
  assert(config.agent.build.options.store === false, 'build store 不正确')
  assert(config.agent.plan.options.store === false, 'plan store 不正确')
})

// ============================================================================
// 测试 2: setup-okmcode-standalone.mjs - 快捷覆盖模式（替换已有配置）
// ============================================================================

console.log('\n📋 测试 2: 独立脚本 - 快捷覆盖模式（替换已有配置）\n')

// 创建包含自定义配置的文件
createTestConfig('claude', {
  env: {
    ANTHROPIC_AUTH_TOKEN: 'old-key',
    ANTHROPIC_BASE_URL: 'https://old.com',
    CUSTOM_ENV: 'should-be-preserved',
  },
  permissions: {
    allow: ['custom-permission'],
  },
  customField: 'custom-value',
})

createTestConfig('codex-auth', {
  OPENAI_API_KEY: 'old-key',
  CUSTOM_FIELD: 'should-be-removed',
})

createTestConfig(
  'codex',
  [
    'model_provider = "old-provider"',
    'custom_field = "should-be-removed"',
    '',
    '[model_providers.old-provider]',
    'name = "old-provider"',
    'base_url = "https://old.example.com"',
    '',
  ].join('\n')
)

createTestConfig('gemini-env', 'CUSTOM_VAR=custom-value\nGEMINI_API_KEY=old-key')

createTestConfig('opencode', {
  provider: {
    other: {
      name: 'Other Provider',
      options: { apiKey: 'other-key' },
    },
  },
})

// 运行脚本
const result2 = runScript('scripts/setup-okmcode-standalone.mjs', [TEST_API_KEY])
assert(result2.success, '脚本执行失败')

test('Claude 应该写入托管默认配置', () => {
  const config = readTestConfig('claude')
  assert(config.model === 'sonnet', 'Claude 默认模型不正确')
  assert(config.env.ANTHROPIC_AUTH_TOKEN === TEST_API_KEY, 'API Key 未更新')
  assert(config.env.ANTHROPIC_BASE_URL === OKMCODE_BASE_URLS.claude, 'Base URL 未更新')
  assert(config.env.CUSTOM_ENV === undefined, '自定义 env 不应保留')
  assert(config.permissions.allow.length === 0, 'permissions 应该重置为空')
  assert(config.customField === undefined, '自定义字段不应保留')
})

test('Claude settings.json 应该在覆盖前备份', () => {
  const backup = JSON.parse(
    fs.readFileSync(path.join(TEST_HOME, '.claude/settings.json.bak'), 'utf-8')
  )
  assert(backup.env.ANTHROPIC_AUTH_TOKEN === 'old-key', 'Claude 备份认证信息不正确')
  assert(backup.customField === 'custom-value', 'Claude 备份未保留原字段')
})

test('Gemini .env 应该写入托管默认配置', () => {
  const env = readTestConfig('gemini-env')
  assert(!env.includes('CUSTOM_VAR=custom-value'), '自定义变量不应保留')
  assert(env.includes(`GEMINI_API_KEY=${TEST_API_KEY}`), 'API Key 未更新')
  assert(env.includes('GEMINI_MODEL=gemini-3.5-flash'), '默认模型未更新')
})

test('Gemini .env 应该在覆盖前备份', () => {
  const backup = fs.readFileSync(path.join(TEST_HOME, '.gemini/.env.bak'), 'utf-8')
  assert(backup.includes('CUSTOM_VAR=custom-value'), 'Gemini 备份未保留原变量')
  assert(backup.includes('GEMINI_API_KEY=old-key'), 'Gemini 备份认证信息不正确')
})

test('Codex auth.json 应该备份并覆盖写入（仅保留 OPENAI_API_KEY）', () => {
  const authPath = path.join(TEST_HOME, '.codex/auth.json')
  const backupPath = `${authPath}.bak`

  assert(fs.existsSync(backupPath), 'auth.json.bak 未创建')

  const auth = JSON.parse(fs.readFileSync(authPath, 'utf-8'))
  assert(auth.OPENAI_API_KEY === TEST_API_KEY, 'API Key 未更新')
  assert(auth.CUSTOM_FIELD === undefined, '不应保留其他字段')

  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf-8'))
  assert(backup.OPENAI_API_KEY === 'old-key', '备份内容不正确')
  assert(backup.CUSTOM_FIELD === 'should-be-removed', '备份未保留原字段')
})

test('Codex config.toml 应该备份并覆盖写入', () => {
  const configPath = path.join(TEST_HOME, '.codex/config.toml')
  const backupPath = `${configPath}.bak`

  assert(fs.existsSync(backupPath), 'config.toml.bak 未创建')

  const config = fs.readFileSync(configPath, 'utf-8')
  assert(config.includes('model_provider = "okmcode"'), 'model_provider 未更新')
  assert(config.includes(`base_url = "${OKMCODE_BASE_URLS.codex}"`), 'base_url 未更新')
  assert(!config.includes('custom_field = "should-be-removed"'), '不应保留自定义字段')

  const backup = fs.readFileSync(backupPath, 'utf-8')
  assert(backup.includes('custom_field = "should-be-removed"'), '备份未保留原字段')
})

test('OpenCode 应该写入托管默认配置', () => {
  const config = readTestConfig('opencode')
  assert(config.provider.other === undefined, '其他 provider 不应保留')
  assert(config.provider.okmcode, 'OKMCode provider 未添加')
  assert(config.model === 'okmcode/gpt-5.5', 'OpenCode 默认模型不正确')
})

test('OpenCode opencode.json 应该在覆盖前备份', () => {
  const backup = JSON.parse(
    fs.readFileSync(path.join(TEST_HOME, '.config/opencode/opencode.json.bak'), 'utf-8')
  )
  assert(backup.provider.other.name === 'Other Provider', 'OpenCode 备份未保留原 provider')
})

// ============================================================================
// 测试 3: @2ue/aicoding Codex 快捷覆盖配置
// ============================================================================

console.log('\n📋 测试 3: @2ue/aicoding Codex 快捷覆盖配置\n')

const aicodingResult = runScript('packages/aicoding/bin/aicoding.js', [
  TEST_API_KEY,
  '--platform',
  'codex',
  '--base-url',
  OKMCODE_BASE_URLS.codex,
])

test('aicoding 应该生成当前 Codex 配置且不包含废弃字段', () => {
  assert(aicodingResult.success, `脚本执行失败: ${aicodingResult.error}`)
  const config = readTestConfig('codex')
  assert(config.includes('model_reasoning_effort = "xhigh"'), '推理强度不正确')
  assert(config.includes('plan_mode_reasoning_effort = "xhigh"'), 'Plan 推理强度不正确')
  assert(config.includes('sandbox_mode = "danger-full-access"'), 'sandbox_mode 不正确')
  assert(config.includes('approval_policy = "never"'), 'approval_policy 不正确')
  assert(config.includes('[features]'), 'features 配置块不存在')
  assert(config.includes('multi_agent = true'), 'multi_agent 未启用')
  assert(!config.includes('disable_response_storage'), '不应写入 disable_response_storage')
  assert(!config.includes('windows_wsl_setup_acknowledged'), '不应写入旧 WSL 确认字段')
  assert(!config.includes('apply_patch_freeform'), '不应写入已移除 feature')
  assert(!config.includes('elevated_windows_sandbox'), '不应写入旧 Windows sandbox feature')
})

// ============================================================================
// 测试 4: setup-okmcode.mjs（基于 anyaitools）
// ============================================================================

console.log('\n📋 测试 4: 基于 anyaitools 的脚本\n')

// 检查是否已构建（检查 dist 目录）
const coreDistPath = path.join(process.cwd(), 'packages/core/dist/index.js')
if (!fs.existsSync(coreDistPath)) {
  console.log('⚠️  core 包未构建，跳过测试')
  console.log('   运行 pnpm build 后再测试\n')
} else {
  // 设置 NODE_ENV=test 以使用测试路径
  process.env.NODE_ENV = 'test'
  process.env.HOME = TEST_HOME

  const result3 = runScript('scripts/setup-okmcode.mjs', [TEST_API_KEY])

  test('基于 anyaitools 的脚本应该成功执行', () => {
    assert(result3.success, `脚本执行失败: ${result3.error}`)
  })

  test('应该创建 anyaitools 配置文件', () => {
    // anyaitools 在测试模式下使用 /tmp/anyaitools-test/.anyaitools
    const anyaitoolsDir = path.join('/tmp/anyaitools-test', '.anyaitools')
    assert(fs.existsSync(anyaitoolsDir), 'anyaitools 配置目录未创建')
  })
}

// ============================================================================
// 测试总结
// ============================================================================

console.log('\n' + '='.repeat(60))
console.log('📊 测试总结')
console.log('='.repeat(60))
console.log(`✅ 通过: ${passedTests}`)
console.log(`❌ 失败: ${failedTests}`)
console.log(`📁 测试目录: ${TEST_ROOT}`)

if (failedTests === 0) {
  console.log('\n🎉 所有测试通过！')
  cleanup()
  console.log('✅ 测试目录已清理')
} else {
  console.log('\n⚠️  部分测试失败，保留测试目录以供调试')
  console.log(`   查看: ${TEST_ROOT}`)
}

process.exit(failedTests > 0 ? 1 : 0)
