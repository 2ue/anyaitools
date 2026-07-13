import { Command } from 'commander'
import chalk from 'chalk'
import inquirer from 'inquirer'
import {
  createGrokManager,
  getGrokConfigPath,
  ProviderNotFoundError,
  type ApiBackend,
  type EditProviderInput,
} from '@anyaitools/core'
import { printSuccess, printTip, printWarning } from '../../utils/cli-output.js'
import {
  addProviderEditOptions,
  resolveProviderEditInput,
  type ProviderEditCommandOptions,
} from '../../utils/provider-params.js'

const API_BACKEND_CHOICES: Array<{ name: string; value: ApiBackend }> = [
  { name: 'OpenAI Responses API', value: 'responses' },
  { name: 'OpenAI Chat Completions', value: 'chat_completions' },
  { name: 'Anthropic Messages API', value: 'messages' },
]

export function editCommand(program: Command): void {
  const command = program.command('edit [name]').description('编辑 Grok Build 服务商')
  addProviderEditOptions(command, { modelConfig: true })

  command.action(async (name: string | undefined, options: ProviderEditCommandOptions) => {
    try {
      const manager = createGrokManager()
      const providers = manager.list()
      if (providers.length === 0) {
        printWarning('暂无 Grok Build 服务商')
        printTip('添加服务商: ' + chalk.white('aat grok add'))
        return
      }

      const resolved = resolveProviderEditInput(options, { allowEmptyApiKey: true })
      let targetId: string
      if (name) {
        const provider = manager.findByName(name)
        if (!provider) throw new ProviderNotFoundError(name)
        targetId = provider.id
      } else if (resolved.nonInteractive) {
        throw new Error('非交互模式请提供要编辑的服务商名称')
      } else {
        const { selectedId } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedId',
            message: '选择要编辑的服务商:',
            choices: providers.map((provider) => ({
              name: `${provider.name} - ${provider.model}`,
              value: provider.id,
            })),
          },
        ])
        targetId = selectedId
      }

      if (resolved.nonInteractive) {
        if (Object.keys(resolved.updates).length === 0) {
          console.log(chalk.gray('\n未做任何修改\n'))
          return
        }
        const updated = manager.edit(targetId, resolved.updates)
        printEditResult(updated, manager.getCurrent()?.id === targetId)
        return
      }

      const provider = manager.get(targetId)
      console.log(chalk.bold('\n✏️  编辑 Grok Build 服务商\n'))
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: '服务商名称:',
          default: provider.name,
          validate: (value) => (value?.trim() ? true : '名称不能为空'),
        },
        {
          type: 'input',
          name: 'desc',
          message: '描述(可选):',
          default: provider.desc ?? '',
        },
        {
          type: 'list',
          name: 'endpointMode',
          message: '模型来源:',
          choices: [
            { name: 'Grok Build 内置模型', value: 'builtin' },
            { name: '自定义 API 端点', value: 'custom' },
          ],
          default: provider.baseUrl ? 'custom' : 'builtin',
        },
        {
          type: 'input',
          name: 'baseUrl',
          message: 'API 地址:',
          default: provider.baseUrl,
          when: (currentAnswers) => currentAnswers.endpointMode === 'custom',
          validate: (value) => validateBaseUrl(value),
        },
        {
          type: 'input',
          name: 'model',
          message: '模型 ID:',
          default: provider.model,
          validate: (value) => (value?.trim() ? true : '模型 ID 不能为空'),
        },
        {
          type: 'list',
          name: 'apiBackend',
          message: 'API 协议:',
          choices: API_BACKEND_CHOICES,
          default: provider.apiBackend ?? 'chat_completions',
          when: (currentAnswers) => currentAnswers.endpointMode === 'custom',
        },
        {
          type: 'confirm',
          name: 'supportsBackendSearch',
          message: '服务端是否支持 Grok backend search?',
          default: provider.supportsBackendSearch ?? false,
          when: (currentAnswers) => currentAnswers.endpointMode === 'custom',
        },
        {
          type: 'list',
          name: 'apiKeyAction',
          message: 'API 密钥:',
          choices: [
            { name: '保持当前设置', value: 'keep' },
            { name: '设置新的内联 API Key', value: 'set' },
            { name: '清除内联 API Key', value: 'clear' },
          ],
          when: (currentAnswers) => currentAnswers.endpointMode === 'custom',
        },
        {
          type: 'password',
          name: 'apiKey',
          message: '新的 API 密钥:',
          mask: '*',
          when: (currentAnswers) =>
            currentAnswers.endpointMode === 'custom' && currentAnswers.apiKeyAction === 'set',
          validate: (value) => (value?.trim() ? true : 'API 密钥不能为空'),
        },
      ])

      const useBuiltinModel = answers.endpointMode === 'builtin'
      const updates: EditProviderInput = {
        name: answers.name.trim(),
        desc: answers.desc.trim(),
        baseUrl: useBuiltinModel ? '' : answers.baseUrl.trim(),
        model: answers.model.trim(),
        ...(useBuiltinModel
          ? {}
          : {
              apiBackend: answers.apiBackend,
              supportsBackendSearch: answers.supportsBackendSearch,
            }),
      }
      if (useBuiltinModel) updates.apiKey = ''
      if (!useBuiltinModel && answers.apiKeyAction === 'set') updates.apiKey = answers.apiKey.trim()
      if (!useBuiltinModel && answers.apiKeyAction === 'clear') updates.apiKey = ''

      const updated = manager.edit(targetId, updates)
      printEditResult(updated, manager.getCurrent()?.id === targetId)
    } catch (error) {
      if (error instanceof ProviderNotFoundError) {
        console.error(chalk.red(`\n❌ 服务商不存在: ${name}\n`))
      } else {
        console.error(chalk.red(`\n❌ ${(error as Error).message}\n`))
      }
      process.exit(1)
    }
  })
}

function validateBaseUrl(value: string, allowEmpty = false): true | string {
  const baseUrl = value?.trim()
  if (!baseUrl) return allowEmpty ? true : 'API 地址不能为空'
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    return 'API 地址必须以 http:// 或 https:// 开头'
  }
  return true
}

function printEditResult(
  provider: { name: string; baseUrl: string; model?: string; apiBackend?: string },
  applied: boolean
): void {
  printSuccess('编辑成功', [
    chalk.bold(provider.name),
    chalk.gray(`URL: ${provider.baseUrl || '(Grok 内置端点)'}`),
    chalk.gray(`模型: ${provider.model}`),
    ...(provider.baseUrl
      ? [chalk.gray(`API Backend: ${provider.apiBackend || 'chat_completions'}`)]
      : []),
    ...(applied ? [chalk.gray(`配置已更新: ${getGrokConfigPath()}`)] : []),
  ])
  if (applied) printTip(`核验最终有效配置: ${chalk.white('grok inspect')}`)
}
