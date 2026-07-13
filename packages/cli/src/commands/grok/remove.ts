import { Command } from 'commander'
import chalk from 'chalk'
import inquirer from 'inquirer'
import { createGrokManager, ProviderNotFoundError } from '@anyaitools/core'
import {
  addProviderRemoveOptions,
  confirmProviderRemoval,
  type ProviderRemoveCommandOptions,
} from '../../utils/provider-params.js'
import { printTip, printWarning } from '../../utils/cli-output.js'

export function removeCommand(program: Command): void {
  const command = program.command('remove [name]').alias('rm').description('删除 Grok Build 服务商')
  addProviderRemoveOptions(command)

  command.action(async (name: string | undefined, options: ProviderRemoveCommandOptions) => {
    try {
      const manager = createGrokManager()
      const providers = manager.list()
      if (providers.length === 0) {
        printWarning('暂无 Grok Build 服务商')
        return
      }

      let targetId: string
      let targetName: string
      if (name) {
        const provider = manager.findByName(name)
        if (!provider) throw new ProviderNotFoundError(name)
        targetId = provider.id
        targetName = provider.name
      } else if (options.yes) {
        throw new Error('非交互模式请提供要删除的服务商名称')
      } else {
        const { selectedId } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedId',
            message: '选择要删除的服务商:',
            choices: providers.map((provider) => ({
              name: `${provider.name} - ${provider.model}`,
              value: provider.id,
            })),
          },
        ])
        const provider = manager.get(selectedId)
        targetId = provider.id
        targetName = provider.name
      }

      if (!(await confirmProviderRemoval(targetName, options))) {
        console.log(chalk.gray('\n已取消\n'))
        return
      }

      manager.remove(targetId)
      console.log(chalk.green(`\n✅ 已删除: ${targetName}\n`))
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
