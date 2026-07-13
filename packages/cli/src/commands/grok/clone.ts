import { Command } from 'commander'
import chalk from 'chalk'
import inquirer from 'inquirer'
import { createGrokManager, ProviderNotFoundError } from '@anyaitools/core'
import { toolBadge } from '../../utils/cli-theme.js'
import { printSuccess, printWarning } from '../../utils/cli-output.js'
import { promptGrokProviderForm } from './form.js'

export function cloneCommand(program: Command): void {
  program
    .command('clone [source-name] [new-name]')
    .description('克隆 Grok Build 服务商')
    .action(async (sourceName?: string, newName?: string) => {
      try {
        const manager = createGrokManager()
        const providers = manager.list()
        if (providers.length === 0) {
          printWarning('暂无 Grok Build 服务商')
          return
        }

        let sourceId: string
        if (sourceName) {
          const provider = manager.findByName(sourceName)
          if (!provider) throw new ProviderNotFoundError(sourceName)
          sourceId = provider.id
        } else {
          const { selectedId } = await inquirer.prompt([
            {
              type: 'list',
              name: 'selectedId',
              message: '选择要克隆的服务商:',
              choices: providers.map((provider) => ({
                name: `${provider.name} - ${provider.model}`,
                value: provider.id,
              })),
            },
          ])
          sourceId = selectedId
        }

        const source = manager.get(sourceId)
        const cloned = newName
          ? manager.clone(sourceId, newName)
          : manager.add(
              await promptGrokProviderForm({
                name: `${source.name}（副本）`,
                desc: '',
                baseUrl: source.baseUrl,
                allowEmptyBaseUrl: source.baseUrl.trim() === '',
                apiKey: source.apiKey,
                model: source.model,
                apiBackend: source.apiBackend,
                supportsBackendSearch: source.supportsBackendSearch,
              })
            )

        printSuccess('克隆成功', [
          `${chalk.bold(cloned.name)} ${toolBadge('grok')}`,
          chalk.gray(`ID: ${cloned.id}`),
          chalk.gray(`URL: ${cloned.baseUrl || '(Grok 内置端点)'}`),
          chalk.gray(`模型: ${cloned.model}`),
          ...(cloned.baseUrl
            ? [chalk.gray(`API Backend: ${cloned.apiBackend || 'chat_completions'}`)]
            : []),
        ])
      } catch (error) {
        if (error instanceof ProviderNotFoundError) {
          console.error(chalk.red(`\n❌ 服务商不存在: ${sourceName}\n`))
        } else {
          console.error(chalk.red(`\n❌ ${(error as Error).message}\n`))
        }
        process.exit(1)
      }
    })
}
