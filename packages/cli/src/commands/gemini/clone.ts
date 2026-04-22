import { Command } from 'commander'
import chalk from 'chalk'
import inquirer from 'inquirer'
import { createGeminiManager } from '@anyaitools/core'

export function cloneCommand(program: Command): void {
  program
    .command('clone [name]')
    .description('克隆 Gemini CLI 服务商')
    .action(async (name?: string) => {
      try {
        const manager = createGeminiManager()
        const providers = manager.list()

        if (providers.length === 0) {
          console.log(chalk.yellow('\n⚠️  暂无 Gemini CLI 服务商\n'))
          console.log(chalk.blue('💡 添加服务商:') + chalk.white(' aat gm add\n'))
          return
        }

        let sourceId: string

        if (name) {
          const provider = manager.findByName(name)
          if (!provider) {
            console.log(chalk.red(`\n❌ 服务商不存在: ${name}\n`))
            process.exit(1)
          }
          sourceId = provider.id
        } else {
          const { selectedId } = await inquirer.prompt([
            {
              type: 'list',
              name: 'selectedId',
              message: '选择要克隆的服务商:',
              choices: providers.map((p) => ({
                name: `${p.name} - ${p.baseUrl || '(默认端点)'}`,
                value: p.id,
              })),
            },
          ])
          sourceId = selectedId
        }

        const { newName } = await inquirer.prompt([
          {
            type: 'input',
            name: 'newName',
            message: '输入新服务商名称:',
            validate: (value) => {
              if (!value) return '名称不能为空'
              return true
            },
          },
        ])

        const newProvider = manager.clone(sourceId, newName)

        console.log()
        console.log(chalk.green('✅ 克隆成功'))
        console.log()
        console.log(`  ${chalk.bold(newProvider.name)} ${chalk.blue('[Gemini CLI]')}`)
        console.log(`  ${chalk.gray(newProvider.baseUrl || '(默认端点)')}`)
        console.log()
      } catch (error) {
        console.error(chalk.red(`\n❌ ${(error as Error).message}\n`))
        process.exit(1)
      }
    })
}

