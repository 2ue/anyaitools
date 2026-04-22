#!/usr/bin/env node
/**
 * OKMCode 快速配置脚本（基于 anyaitools）
 *
 * 功能：将 OKMCode 服务商配置到所有 AI 编程工具
 * 策略：快捷配置入口，最终按覆盖写入应用到目标工具配置
 *
 * 用法：
 *   node scripts/setup-okmcode.mjs              # 交互式输入
 *   node scripts/setup-okmcode.mjs sk-ant-xxx   # 直接传入 API Key
 *
 * 依赖：需要先构建 core 包（pnpm build）
 */

import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import {
  createClaudeManager,
  createCodexManager,
  createGeminiManager,
  createOpenCodeManager,
} from '../packages/core/dist/index.js'

const PROVIDER_NAME = 'OKMCode'
const OKMCODE_BASE_URLS = {
  claude: 'https://okmcode.com',
  codex: 'https://okmcode.com',
  gemini: 'https://okmcode.com',
  opencode: 'https://okmcode.com',
}

const tools = [
  { name: 'Claude Code', manager: createClaudeManager(), baseUrl: OKMCODE_BASE_URLS.claude },
  { name: 'Codex', manager: createCodexManager(), baseUrl: OKMCODE_BASE_URLS.codex },
  { name: 'Gemini CLI', manager: createGeminiManager(), baseUrl: OKMCODE_BASE_URLS.gemini },
  { name: 'OpenCode', manager: createOpenCodeManager(), baseUrl: OKMCODE_BASE_URLS.opencode },
]

async function main() {
  console.log('🚀 OKMCode 快速配置工具\n')

  // 1. 获取 API Key
  let apiKey = process.argv[2]

  if (!apiKey) {
    const rl = createInterface({ input: stdin, output: stdout })
    apiKey = await rl.question('请输入 OKMCode API Key: ')
    rl.close()
  }

  if (!apiKey?.trim()) {
    throw new Error('API Key 不能为空')
  }

  console.log('\n开始配置...\n')

  // 2. 配置所有工具
  for (const { name, manager, baseUrl } of tools) {
    try {
      const existing = manager.findByName(PROVIDER_NAME)

      const provider = existing
        ? manager.edit(existing.id, { baseUrl, apiKey }, { applyWrite: false })
        : manager.add({ name: PROVIDER_NAME, baseUrl, apiKey })

      manager.switch(provider.id, { mode: 'overwrite' })
      console.log(`✅ ${name}`)
    } catch (error) {
      console.error(`❌ ${name}: ${error.message}`)
    }
  }

  console.log('\n🎉 OKMCode 配置完成！')
  console.log('\n提示：请重启对应的工具以使配置生效。')
}

main().catch((err) => {
  console.error(`\n❌ 错误: ${err.message}`)
  process.exit(1)
})
