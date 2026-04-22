import { Command } from 'commander'
import chalk from 'chalk'
import {
  createCodexManager,
  createClaudeManager,
  createGeminiManager,
  createOpenClawManager,
} from '@anyaitools/core'
import { loadSyncConfig } from '../../utils/sync-config.js'

export function statusCommand(program: Command): void {
  program
    .command('status')
    .description('查看同步状态')
    .action(async () => {
      try {
        const config = loadSyncConfig()

        console.log(chalk.bold('\n📊 同步状态\n'))

        if (!config) {
          console.log(chalk.yellow('⚠️  未配置 WebDAV 同步'))
          console.log()
          console.log(chalk.blue('💡 开始配置: aat sync config\n'))
          return
        }

        // WebDAV 配置
        console.log(chalk.bold('WebDAV 配置:'))
        console.log(`  URL: ${chalk.gray(config.webdavUrl)}`)
        console.log(`  用户: ${chalk.gray(config.username)}`)
        console.log(`  远程目录: ${chalk.gray(config.remoteDir)}`)
        console.log(
          `  认证: ${chalk.gray(config.authType === 'password' ? 'Basic Auth' : 'Digest Auth')}`
        )
        console.log(
          `  同步密码: ${config.syncPassword ? chalk.green('✓ 已保存') : chalk.yellow('✗ 未保存')}`
        )
        console.log()

        // 本地配置
        const codexManager = createCodexManager()
        const claudeManager = createClaudeManager()
        const geminiManager = createGeminiManager()
        const openclawManager = createOpenClawManager()
        const codexProviders = codexManager.list()
        const claudeProviders = claudeManager.list()
        const geminiProviders = geminiManager.list()
        const openclawProviders = openclawManager.list()

        console.log(chalk.bold('本地配置:'))
        console.log(`  Codex: ${chalk.cyan(codexProviders.length)} 个服务商`)
        console.log(`  Claude: ${chalk.cyan(claudeProviders.length)} 个服务商`)
        console.log(`  Gemini: ${chalk.cyan(geminiProviders.length)} 个服务商`)
        console.log(`  OpenClaw: ${chalk.cyan(openclawProviders.length)} 个服务商`)

        if (config.lastSync) {
          const date = new Date(config.lastSync).toLocaleString('zh-CN')
          console.log(`  最后同步: ${chalk.gray(date)}`)
        }

        console.log()

        // 同步建议
        console.log(chalk.bold('同步建议:'))
        console.log(chalk.blue('  💡 上传到云端: aat sync upload'))
        console.log(chalk.blue('  💡 从云端下载: aat sync download'))
        console.log(chalk.blue('  💡 智能合并: aat sync merge'))
        console.log()
      } catch (error) {
        console.error(chalk.red(`\n❌ ${(error as Error).message}\n`))
      }
    })
}
