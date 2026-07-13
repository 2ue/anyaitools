import { Command } from 'commander'
import chalk from 'chalk'
import { createGrokManager, getGrokConfigPath } from '@anyaitools/core'
import { printInfo, printTip, printWarning } from '../../utils/cli-output.js'

export function currentCommand(program: Command): void {
  program
    .command('current')
    .description('显示当前 Grok Build 服务商')
    .action(async () => {
      try {
        const current = createGrokManager().getCurrent()
        if (!current) {
          printWarning('未选择任何 Grok Build 服务商')
          printTip('选择服务商: ' + chalk.white('aat grok use'))
          return
        }

        const lines = [
          chalk.green.bold(current.name),
          chalk.gray(`ID: ${current.id}`),
          chalk.gray(`URL: ${current.baseUrl || '(Grok 内置端点)'}`),
          chalk.gray(`模型: ${current.model}`),
          chalk.gray(
            `认证: ${current.apiKey ? '内联 API Key' : current.baseUrl ? '未写入内联 API Key' : 'Grok 登录 / XAI_API_KEY'}`
          ),
          chalk.gray(`用户配置: ${getGrokConfigPath()}`),
        ]
        if (current.baseUrl) {
          lines.splice(
            4,
            0,
            chalk.gray(`API Backend: ${current.apiBackend || 'chat_completions'}`),
            chalk.gray(`Backend Search: ${current.supportsBackendSearch ? '启用' : '禁用'}`)
          )
        }
        if (current.lastUsedAt) {
          lines.push(
            chalk.gray(`最后使用: ${new Date(current.lastUsedAt).toLocaleString('zh-CN')}`)
          )
        }
        printInfo('📍 当前 Grok Build 服务商', lines)
        printTip(`核验最终有效配置: ${chalk.white('grok inspect')}`)
      } catch (error) {
        console.error(chalk.red(`\n❌ ${(error as Error).message}\n`))
        process.exit(1)
      }
    })
}
