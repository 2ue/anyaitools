import inquirer from 'inquirer'
import type { AddProviderInput, ApiBackend } from '@anyaitools/core'

const API_BACKEND_CHOICES: Array<{ name: string; value: ApiBackend }> = [
  { name: 'OpenAI Responses API', value: 'responses' },
  { name: 'OpenAI Chat Completions', value: 'chat_completions' },
  { name: 'Anthropic Messages API', value: 'messages' },
]

export interface GrokProviderFormDefaults {
  name?: string
  desc?: string
  baseUrl?: string
  allowEmptyBaseUrl?: boolean
  apiKey?: string
  model?: string
  apiBackend?: ApiBackend
  supportsBackendSearch?: boolean
}

export async function promptGrokProviderForm(
  defaults: GrokProviderFormDefaults = {}
): Promise<AddProviderInput> {
  const defaultMode = defaults.allowEmptyBaseUrl && !defaults.baseUrl?.trim() ? 'builtin' : 'custom'
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: '服务商名称:',
      default: defaults.name,
      validate: (value) => (value?.trim() ? true : '名称不能为空'),
    },
    {
      type: 'input',
      name: 'desc',
      message: '描述(可选):',
      default: defaults.desc,
    },
    {
      type: 'list',
      name: 'endpointMode',
      message: '模型来源:',
      choices: [
        { name: 'Grok Build 内置模型', value: 'builtin' },
        { name: '自定义 API 端点', value: 'custom' },
      ],
      default: defaultMode,
    },
    {
      type: 'input',
      name: 'baseUrl',
      message: 'API 地址:',
      default: defaultMode === 'custom' ? defaults.baseUrl : '',
      when: (currentAnswers) => currentAnswers.endpointMode === 'custom',
      validate: (value) => {
        const baseUrl = value?.trim()
        if (!baseUrl) return 'API 地址不能为空'
        if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
          return 'API 地址必须以 http:// 或 https:// 开头'
        }
        return true
      },
    },
    {
      type: 'input',
      name: 'model',
      message: '模型 ID:',
      default: defaults.model,
      validate: (value) => (value?.trim() ? true : '模型 ID 不能为空'),
    },
    {
      type: 'list',
      name: 'apiBackend',
      message: 'API 协议:',
      choices: API_BACKEND_CHOICES,
      default: defaults.apiBackend ?? 'chat_completions',
      when: (currentAnswers) => currentAnswers.endpointMode === 'custom',
    },
    {
      type: 'confirm',
      name: 'supportsBackendSearch',
      message: '服务端是否支持 Grok backend search?',
      default: defaults.supportsBackendSearch ?? false,
      when: (currentAnswers) => currentAnswers.endpointMode === 'custom',
    },
    {
      type: 'password',
      name: 'apiKey',
      message: 'API 密钥 (可选，留空不写入内联 Key):',
      mask: '*',
      default: defaults.apiKey,
      when: (currentAnswers) => currentAnswers.endpointMode === 'custom',
    },
  ])

  const useBuiltinModel = answers.endpointMode === 'builtin'
  return {
    name: answers.name.trim(),
    desc: answers.desc?.trim() || undefined,
    baseUrl: useBuiltinModel ? '' : answers.baseUrl.trim(),
    apiKey: useBuiltinModel ? '' : answers.apiKey?.trim() || '',
    model: answers.model.trim(),
    ...(useBuiltinModel
      ? {}
      : {
          apiBackend: answers.apiBackend,
          supportsBackendSearch: answers.supportsBackendSearch,
        }),
  }
}
