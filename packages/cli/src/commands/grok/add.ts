import { Command } from 'commander'
import chalk from 'chalk'
import inquirer from 'inquirer'
import { createGrokManager, getGrokConfigPath, GROK_PRESETS } from '@anyaitools/core'
import { promptConfirm } from '../../utils/confirm.js'
import { printSuccess, printTip } from '../../utils/cli-output.js'
import { toolBadge } from '../../utils/cli-theme.js'
import {
  addProviderAddOptions,
  resolveProviderAddInput,
  type ProviderAddCommandOptions,
} from '../../utils/provider-params.js'
import { promptGrokProviderForm, type GrokProviderFormDefaults } from './form.js'

const GROK_INPUT_RULES = {
  allowEmptyPresetBaseUrl: true,
  allowEmptyApiKey: true,
  requireModel: true,
} as const

export function addCommand(program: Command): void {
  const command = program.command('add').description('添加新的 Grok Build 服务商')
  addProviderAddOptions(command, { modelConfig: true })

  command.action(async (options: ProviderAddCommandOptions) => {
    try {
      const manager = createGrokManager()
      console.log(chalk.bold('\n📝 添加 Grok Build 服务商\n'))

      const resolved = resolveProviderAddInput(options, GROK_PRESETS, GROK_INPUT_RULES)
      if (resolved.nonInteractive && resolved.input) {
        const provider = manager.add(resolved.input)
        printSuccess('添加成功', providerDetails(provider))

        if (resolved.switchNow) {
          manager.switch(provider.id)
          printSwitchResult()
        } else {
          printTip(`稍后切换: ${chalk.white(`aat grok use "${provider.name}"`)}`)
        }
        return
      }

      const { usePreset } = await inquirer.prompt([
        {
          type: 'list',
          name: 'usePreset',
          message: '选择配置来源:',
          choices: [
            { name: '📦 使用 xAI 官方预设', value: true },
            { name: '✏️  自定义兼容服务商', value: false },
          ],
        },
      ])

      let defaults: GrokProviderFormDefaults = {
        apiKey: '',
        apiBackend: 'chat_completions',
        supportsBackendSearch: false,
      }

      if (usePreset) {
        const { presetName } = await inquirer.prompt([
          {
            type: 'list',
            name: 'presetName',
            message: '选择预置服务商:',
            choices: GROK_PRESETS.map((preset) => ({
              name: `${preset.name} - ${preset.description}`,
              value: preset.name,
            })),
          },
        ])
        const preset = GROK_PRESETS.find((item) => item.name === presetName)!
        console.log(chalk.blue(`\n使用预设: ${preset.name} - ${preset.description}\n`))
        defaults = {
          name: preset.name,
          desc: '',
          baseUrl: preset.baseUrl,
          allowEmptyBaseUrl: preset.baseUrl.trim() === '',
          apiKey: '',
          model: preset.model,
          apiBackend: preset.apiBackend,
          supportsBackendSearch: preset.supportsBackendSearch,
        }
      }

      const input = await promptGrokProviderForm(defaults)
      const provider = manager.add(input)
      printSuccess('添加成功', providerDetails(provider))

      if (await promptConfirm('是否立即切换到此服务商?', true)) {
        manager.switch(provider.id)
        printSwitchResult()
      } else {
        printTip(`稍后切换: ${chalk.white(`aat grok use "${provider.name}"`)}`)
      }
    } catch (error) {
      console.error(chalk.red(`\n❌ ${(error as Error).message}\n`))
      process.exit(1)
    }
  })
}

function providerDetails(provider: {
  name: string
  baseUrl: string
  model?: string
  apiBackend?: string
  supportsBackendSearch?: boolean
  apiKey: string
}): string[] {
  const details = [
    `${chalk.bold(provider.name)} ${toolBadge('grok')}`,
    chalk.gray(`URL: ${provider.baseUrl || '(Grok 内置端点)'}`),
    chalk.gray(`模型: ${provider.model}`),
    chalk.gray(
      `认证: ${provider.apiKey ? '内联 API Key' : provider.baseUrl ? '未写入内联 API Key' : 'Grok 登录 / XAI_API_KEY'}`
    ),
  ]
  if (provider.baseUrl) {
    details.splice(
      3,
      0,
      chalk.gray(`API Backend: ${provider.apiBackend || 'chat_completions'}`),
      chalk.gray(`Backend Search: ${provider.supportsBackendSearch ? '启用' : '禁用'}`)
    )
  }
  return details
}

function printSwitchResult(): void {
  printSuccess('已切换到新服务商', [chalk.gray(`配置已更新: ${getGrokConfigPath()}`)])
  printTip(`核验最终有效配置: ${chalk.white('grok inspect')}`)
}
