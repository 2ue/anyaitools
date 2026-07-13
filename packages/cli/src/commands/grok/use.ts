import { Command } from 'commander'
import chalk from 'chalk'
import inquirer from 'inquirer'
import { createGrokManager, getGrokConfigPath, ProviderNotFoundError } from '@anyaitools/core'
import { printSuccess, printTip, printWarning } from '../../utils/cli-output.js'
import { toolBadge } from '../../utils/cli-theme.js'

export function useCommand(program: Command): void {
  program
    .command('use [name]')
    .description('切换 Grok Build 服务商')
    .action(async (name?: string) => {
      try {
        const manager = createGrokManager()
        const providers = manager.list()

        if (providers.length === 0) {
          printWarning('暂无 Grok Build 服务商')
          printTip('添加服务商: ' + chalk.white('aat grok add'))
          return
        }

        let targetId: string
        if (name) {
          const provider = manager.findByName(name)
          if (!provider) throw new ProviderNotFoundError(name)
          targetId = provider.id
        } else {
          const { selectedId } = await inquirer.prompt([
            {
              type: 'list',
              name: 'selectedId',
              message: '选择要切换的服务商:',
              choices: providers.map((provider) => ({
                name: provider.baseUrl
                  ? `${provider.name} - ${provider.model} (${provider.apiBackend || 'chat_completions'})`
                  : `${provider.name} - ${provider.model} (内置模型)`,
                value: provider.id,
              })),
            },
          ])
          targetId = selectedId
        }

        manager.switch(targetId)
        const provider = manager.get(targetId)
        const details = [
          `${chalk.bold(provider.name)} ${toolBadge('grok')}`,
          chalk.gray(`URL: ${provider.baseUrl || '(Grok 内置端点)'}`),
          chalk.gray(`模型: ${provider.model}`),
          chalk.gray(`配置已更新: ${getGrokConfigPath()}`),
        ]
        if (provider.baseUrl) {
          details.splice(
            3,
            0,
            chalk.gray(`API Backend: ${provider.apiBackend || 'chat_completions'}`),
            chalk.gray(`Backend Search: ${provider.supportsBackendSearch ? '启用' : '禁用'}`)
          )
        }
        printSuccess('切换成功', details)
        printTip(`核验最终有效配置: ${chalk.white('grok inspect')}`)
      } catch (error) {
        if (error instanceof ProviderNotFoundError) {
          console.error(chalk.red(`\n❌ 服务商不存在: ${name}\n`))
          printTip('查看所有服务商: ' + chalk.white('aat grok list'))
        } else {
          console.error(chalk.red(`\n❌ ${(error as Error).message}\n`))
        }
        process.exit(1)
      }
    })
}
