#!/usr/bin/env node
/**
 * okmcode 快速配置脚本（基于 anyaitools）
 *
 * 功能：将 okmcode 服务商配置到所有 AI 编程工具
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
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  createClaudeManager,
  createCodexManager,
  createGeminiManager,
  createOpenCodeManager,
  getAnyAIToolsDir,
  getClaudeConfigPath,
  getCodexAuthPath,
  getCodexConfigPath,
  getGeminiEnvPath,
  getGeminiSettingsPath,
  getOpenCodeConfigPath,
} from '../packages/core/dist/index.js'

const PROVIDER_NAME = 'okmcode'
const OKMCODE_BASE_URLS = {
  claude: 'https://okmcode.com',
  codex: 'https://okmcode.com',
  gemini: 'https://okmcode.com',
  opencode: 'https://okmcode.com',
}

const tools = [
  {
    name: 'Claude Code',
    manager: createClaudeManager(),
    baseUrl: OKMCODE_BASE_URLS.claude,
    targetFiles: [path.join(getAnyAIToolsDir(), 'claude.json'), getClaudeConfigPath()],
  },
  {
    name: 'Codex',
    manager: createCodexManager(),
    baseUrl: OKMCODE_BASE_URLS.codex,
    targetFiles: [
      path.join(getAnyAIToolsDir(), 'codex.json'),
      getCodexConfigPath(),
      getCodexAuthPath(),
    ],
  },
  {
    name: 'Gemini CLI',
    manager: createGeminiManager(),
    baseUrl: OKMCODE_BASE_URLS.gemini,
    targetFiles: [
      path.join(getAnyAIToolsDir(), 'gemini.json'),
      getGeminiSettingsPath(),
      getGeminiEnvPath(),
    ],
  },
  {
    name: 'OpenCode',
    manager: createOpenCodeManager(),
    baseUrl: OKMCODE_BASE_URLS.opencode,
    targetFiles: [path.join(getAnyAIToolsDir(), 'opencode.json'), getOpenCodeConfigPath()],
  },
]

function backupTargetsOrThrow(targetFiles) {
  return targetFiles.map((filePath) => {
    const existed = fs.existsSync(filePath)
    const backupPath = `${filePath}.bak`
    if (existed) {
      try {
        fs.copyFileSync(filePath, backupPath)
        fs.chmodSync(backupPath, 0o600)
      } catch (error) {
        throw new Error(`备份失败，已中止后续写入（${filePath}）: ${error.message}`)
      }
    }
    return { filePath, backupPath, existed }
  })
}

function rollbackTargets(entries) {
  for (const entry of entries) {
    if (entry.existed) {
      fs.copyFileSync(entry.backupPath, entry.filePath)
    } else if (fs.existsSync(entry.filePath)) {
      fs.rmSync(entry.filePath, { force: true })
    }
  }
}

async function main() {
  console.log('🚀 okmcode 快速配置工具\n')

  // 1. 获取 API Key
  let apiKey = process.argv[2]

  if (!apiKey) {
    const rl = createInterface({ input: stdin, output: stdout })
    apiKey = await rl.question('请输入 okmcode API Key: ')
    rl.close()
  }

  if (!apiKey?.trim()) {
    throw new Error('API Key 不能为空')
  }

  console.log('\n开始配置...\n')

  // 2. 配置所有工具
  for (const { name, manager, baseUrl, targetFiles } of tools) {
    let backupEntries = []
    try {
      backupEntries = backupTargetsOrThrow(targetFiles)
      const existing = manager.findByName(PROVIDER_NAME)

      const provider = existing
        ? manager.edit(existing.id, { baseUrl, apiKey }, { applyWrite: false })
        : manager.add({ name: PROVIDER_NAME, baseUrl, apiKey })

      manager.switch(provider.id, { mode: 'overwrite' })
      console.log(`✅ ${name}`)
    } catch (error) {
      try {
        rollbackTargets(backupEntries)
        console.error(`❌ ${name}: ${error.message}（已回滚）`)
      } catch (rollbackError) {
        console.error(`❌ ${name}: ${error.message}；回滚失败: ${rollbackError.message}`)
      }
    }
  }

  console.log('\n🎉 okmcode 配置完成！')
  console.log('\n提示：请重启对应的工具以使配置生效。')
}

main().catch((err) => {
  console.error(`\n❌ 错误: ${err.message}`)
  process.exit(1)
})
