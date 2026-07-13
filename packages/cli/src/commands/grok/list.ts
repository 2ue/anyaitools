import { Command } from 'commander'
import chalk from 'chalk'
import { createGrokManager } from '@anyaitools/core'
import { printTip, printWarning } from '../../utils/cli-output.js'
import { toolColor } from '../../utils/cli-theme.js'

export function listCommand(program: Command): void {
  program
    .command('list')
    .alias('ls')
    .description('列出所有 Grok Build 服务商')
    .action(async () => {
      try {
        const manager = createGrokManager()
        const providers = manager.list()
        const current = manager.getCurrent()

        if (providers.length === 0) {
          printWarning('暂无 Grok Build 服务商')
          printTip('添加服务商: ' + chalk.white('aat grok add'))
          return
        }

        const color = toolColor('grok')
        console.log(chalk.bold(`\n📋 Grok Build 服务商 (${providers.length} 个)\n`))
        providers.forEach((provider, index) => {
          const isCurrent = provider.id === current?.id
          const marker = isCurrent ? color('●') : chalk.gray('○')
          const name = isCurrent ? color.bold(provider.name) : chalk.white(provider.name)
          console.log(`  ${marker}  ${name}${isCurrent ? color(' [当前]') : ''}`)
          console.log(chalk.gray(`     ${provider.baseUrl || '(Grok 内置端点)'}`))
          const modelDetails = provider.baseUrl
            ? `模型: ${provider.model} · ${provider.apiBackend || 'chat_completions'} · Backend Search: ${provider.supportsBackendSearch ? '启用' : '禁用'}`
            : `模型: ${provider.model}`
          console.log(chalk.gray(`     ${modelDetails}`))
          if (provider.desc) console.log(chalk.gray(`     ${provider.desc}`))
          if (index < providers.length - 1) console.log()
        })
        console.log()
      } catch (error) {
        console.error(chalk.red(`\n❌ ${(error as Error).message}\n`))
        process.exit(1)
      }
    })
}
