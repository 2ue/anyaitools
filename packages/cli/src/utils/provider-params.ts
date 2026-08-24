import { Command } from 'commander'
import type { AddProviderInput, ApiBackend, EditProviderInput } from '@anyaitools/core'
import { promptConfirm } from './confirm.js'

const API_BACKENDS: ApiBackend[] = ['chat_completions', 'responses', 'messages']

export interface ProviderAddCommandOptions {
  preset?: string
  name?: string
  desc?: string
  baseUrl?: string
  apiKey?: string
  model?: string
  reasoningEffort?: string
  modelVariant?: string
  thinkingBudget?: number
  showThinking?: boolean
  apiBackend?: ApiBackend
  supportsBackendSearch?: boolean
  switch?: boolean
  skipSwitch?: boolean
}

export interface ProviderEditCommandOptions {
  newName?: string
  desc?: string
  baseUrl?: string
  apiKey?: string
  model?: string
  reasoningEffort?: string
  modelVariant?: string
  thinkingBudget?: number
  showThinking?: boolean
  apiBackend?: ApiBackend
  supportsBackendSearch?: boolean
}

export interface ProviderRemoveCommandOptions {
  yes?: boolean
}

export interface ProviderInputRules {
  allowEmptyBaseUrl?: boolean
  allowEmptyPresetBaseUrl?: boolean
  allowEmptyApiKey?: boolean
  requireModel?: boolean
  defaultApiBackend?: ApiBackend
  defaultSupportsBackendSearch?: boolean
}

export interface ProviderOptionCapabilities {
  modelConfig?: boolean
  modelOptions?: boolean
}

interface ProviderPresetLike {
  name: string
  baseUrl: string
  model?: string
  apiBackend?: ApiBackend
  supportsBackendSearch?: boolean
}

export interface ResolvedProviderAddInput {
  nonInteractive: boolean
  switchNow: boolean
  input?: AddProviderInput
}

export interface ResolvedProviderEditInput {
  nonInteractive: boolean
  updates: EditProviderInput
}

function trimCliValue(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined
  }

  return value.trim()
}

function validateBaseUrl(baseUrl: string, allowEmpty = false): void {
  if (!baseUrl) {
    if (allowEmpty) {
      return
    }
    throw new Error('缺少参数: --base-url')
  }

  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    throw new Error('API 地址必须以 http:// 或 https:// 开头')
  }
}

function validateApiKey(apiKey: string, allowEmpty = false): void {
  if (!apiKey && !allowEmpty) {
    throw new Error('缺少参数: --api-key')
  }
}

function validateModel(model: string | undefined, required = false): void {
  if (required && !model) {
    throw new Error('缺少参数: --model')
  }
}

function validateApiBackend(
  apiBackend: string | undefined
): asserts apiBackend is ApiBackend | undefined {
  if (apiBackend !== undefined && !API_BACKENDS.includes(apiBackend as ApiBackend)) {
    throw new Error(`API Backend 必须是以下值之一: ${API_BACKENDS.join(', ')}`)
  }
}

function resolvePreset(
  presets: ProviderPresetLike[],
  presetName?: string
): ProviderPresetLike | undefined {
  const normalizedName = trimCliValue(presetName)
  if (!normalizedName) {
    return undefined
  }

  const preset = presets.find((item) => item.name.toLowerCase() === normalizedName.toLowerCase())
  if (!preset) {
    throw new Error(`预设不存在: ${normalizedName}`)
  }
  return preset
}

function addModelOptions(command: Command, edit = false): void {
  command
    .option(`--model <model>`, edit ? '新的模型 ID' : '模型 ID')
    .option('--reasoning-effort <value>', edit ? '新的推理强度' : '推理强度')
    .option('--model-variant <variant>', edit ? '新的模型 variant' : '模型 variant')
    .option(
      '--thinking-budget <tokens>',
      edit ? '新的思考 token 预算' : '思考 token 预算',
      (value) => Number(value)
    )
    .option('--show-thinking', '显示思考内容或 thinking blocks')
}

function addModelConfigOptions(command: Command, edit = false): void {
  addModelOptions(command, edit)
  command
    .option(
      '--api-backend <backend>',
      edit
        ? '新的 API 协议 (chat_completions, responses, messages)'
        : 'API 协议 (chat_completions, responses, messages)'
    )
    .option('--supports-backend-search', '启用服务端搜索能力')
    .option('--no-supports-backend-search', '禁用服务端搜索能力')
}

export function addProviderAddOptions(
  command: Command,
  capabilities: ProviderOptionCapabilities = {}
): void {
  command
    .option('--preset <name>', '使用指定预设')
    .option('--name <name>', '服务商名称')
    .option('--desc <desc>', '描述')
    .option('--base-url <url>', 'API 地址')
    .option('--api-key <key>', 'API 密钥')

  if (capabilities.modelConfig) {
    addModelConfigOptions(command)
  } else if (capabilities.modelOptions) {
    addModelOptions(command)
  }

  command.option('--switch', '添加后立即切换').option('--skip-switch', '添加后不切换')
}

export function addProviderEditOptions(
  command: Command,
  capabilities: ProviderOptionCapabilities = {}
): void {
  command
    .option('--new-name <name>', '新的服务商名称')
    .option('--desc <desc>', '新的描述；传空字符串可清空')
    .option('--base-url <url>', '新的 API 地址')
    .option('--api-key <key>', '新的 API 密钥')

  if (capabilities.modelConfig) {
    addModelConfigOptions(command, true)
  } else if (capabilities.modelOptions) {
    addModelOptions(command, true)
  }
}

export function addProviderRemoveOptions(command: Command): void {
  command.option('-y, --yes', '跳过删除确认')
}

export function resolveProviderAddInput(
  options: ProviderAddCommandOptions,
  presets: ProviderPresetLike[],
  rules: ProviderInputRules = {}
): ResolvedProviderAddInput {
  if (options.switch && options.skipSwitch) {
    throw new Error('不能同时使用 --switch 和 --skip-switch')
  }

  const nonInteractive =
    options.preset !== undefined ||
    options.name !== undefined ||
    options.desc !== undefined ||
    options.baseUrl !== undefined ||
    options.apiKey !== undefined ||
    options.model !== undefined ||
    options.reasoningEffort !== undefined ||
    options.modelVariant !== undefined ||
    options.thinkingBudget !== undefined ||
    options.showThinking !== undefined ||
    options.apiBackend !== undefined ||
    options.supportsBackendSearch !== undefined ||
    options.switch === true ||
    options.skipSwitch === true

  if (!nonInteractive) {
    return {
      nonInteractive: false,
      switchNow: false,
    }
  }

  const preset = resolvePreset(presets, options.preset)
  const name = trimCliValue(options.name) ?? preset?.name
  const desc = options.desc === undefined ? undefined : options.desc.trim() || undefined
  const baseUrl = trimCliValue(options.baseUrl) ?? preset?.baseUrl ?? ''
  const apiKey = options.apiKey === undefined ? '' : options.apiKey.trim()
  const model = trimCliValue(options.model) ?? trimCliValue(preset?.model)
  const reasoningEffort = trimCliValue(options.reasoningEffort)
  const modelVariant = trimCliValue(options.modelVariant)
  const thinkingBudget = options.thinkingBudget
  const apiBackend = options.apiBackend ?? preset?.apiBackend ?? rules.defaultApiBackend
  const supportsBackendSearch =
    options.supportsBackendSearch ??
    preset?.supportsBackendSearch ??
    rules.defaultSupportsBackendSearch

  if (!name) {
    throw new Error('缺少参数: --name')
  }

  const usesPresetBaseUrl = preset !== undefined && options.baseUrl === undefined
  const allowEmptyBaseUrl =
    rules.allowEmptyBaseUrl || (rules.allowEmptyPresetBaseUrl && usesPresetBaseUrl)

  validateBaseUrl(baseUrl, allowEmptyBaseUrl)
  validateApiKey(apiKey, rules.allowEmptyApiKey)
  validateModel(model, rules.requireModel)
  if (thinkingBudget !== undefined && (!Number.isFinite(thinkingBudget) || thinkingBudget < 0)) {
    throw new Error('--thinking-budget 必须是非负数字')
  }
  validateApiBackend(apiBackend)

  return {
    nonInteractive: true,
    switchNow: options.switch === true,
    input: {
      name,
      desc,
      baseUrl,
      apiKey,
      ...(model !== undefined ? { model } : {}),
      ...(reasoningEffort ||
      modelVariant ||
      thinkingBudget !== undefined ||
      options.showThinking !== undefined
        ? {
            modelConfig: {
              ...(model ? { modelId: model } : {}),
              source: 'manual' as const,
              ...(modelVariant ? { variant: modelVariant } : {}),
              ...(reasoningEffort ||
              thinkingBudget !== undefined ||
              options.showThinking !== undefined
                ? {
                    reasoning: {
                      mode:
                        thinkingBudget !== undefined
                          ? 'budget'
                          : modelVariant
                            ? 'variant'
                            : 'effort',
                      ...(thinkingBudget !== undefined
                        ? { value: thinkingBudget }
                        : reasoningEffort
                          ? { value: reasoningEffort }
                          : {}),
                      ...(options.showThinking !== undefined
                        ? { visible: options.showThinking }
                        : {}),
                    },
                  }
                : {}),
            },
          }
        : {}),
      ...(apiBackend !== undefined ? { apiBackend } : {}),
      ...(supportsBackendSearch !== undefined ? { supportsBackendSearch } : {}),
    },
  }
}

export function resolveProviderEditInput(
  options: ProviderEditCommandOptions,
  rules: ProviderInputRules = {}
): ResolvedProviderEditInput {
  const nonInteractive =
    options.newName !== undefined ||
    options.desc !== undefined ||
    options.baseUrl !== undefined ||
    options.apiKey !== undefined ||
    options.model !== undefined ||
    options.reasoningEffort !== undefined ||
    options.modelVariant !== undefined ||
    options.thinkingBudget !== undefined ||
    options.showThinking !== undefined ||
    options.apiBackend !== undefined ||
    options.supportsBackendSearch !== undefined

  const updates: EditProviderInput = {}

  if (options.newName !== undefined) {
    const newName = trimCliValue(options.newName)
    if (!newName) {
      throw new Error('服务商名称不能为空')
    }
    updates.name = newName
  }

  if (options.desc !== undefined) {
    updates.desc = options.desc.trim()
  }

  if (options.baseUrl !== undefined) {
    const baseUrl = trimCliValue(options.baseUrl) ?? ''
    validateBaseUrl(baseUrl, rules.allowEmptyBaseUrl)
    updates.baseUrl = baseUrl
  }

  if (options.apiKey !== undefined) {
    const apiKey = options.apiKey.trim()
    validateApiKey(apiKey, rules.allowEmptyApiKey)
    updates.apiKey = apiKey
  }

  if (options.model !== undefined) {
    const model = options.model.trim()
    validateModel(model, true)
    updates.model = model
  }

  if (
    options.reasoningEffort !== undefined ||
    options.modelVariant !== undefined ||
    options.thinkingBudget !== undefined ||
    options.showThinking !== undefined
  ) {
    const thinkingBudget = options.thinkingBudget
    if (thinkingBudget !== undefined && (!Number.isFinite(thinkingBudget) || thinkingBudget < 0)) {
      throw new Error('--thinking-budget 必须是非负数字')
    }
    updates.modelConfig = {
      ...(options.model ? { modelId: options.model.trim() } : {}),
      source: 'manual',
      ...(options.modelVariant ? { variant: options.modelVariant.trim() } : {}),
      reasoning: {
        mode: thinkingBudget !== undefined ? 'budget' : options.modelVariant ? 'variant' : 'effort',
        ...(thinkingBudget !== undefined
          ? { value: thinkingBudget }
          : options.reasoningEffort
            ? { value: options.reasoningEffort.trim() }
            : {}),
        ...(options.showThinking !== undefined ? { visible: options.showThinking } : {}),
      },
    }
  }

  if (options.apiBackend !== undefined) {
    validateApiBackend(options.apiBackend)
    updates.apiBackend = options.apiBackend
  }

  if (options.supportsBackendSearch !== undefined) {
    updates.supportsBackendSearch = options.supportsBackendSearch
  }

  return {
    nonInteractive,
    updates,
  }
}

export async function confirmProviderRemoval(
  providerName: string,
  options: ProviderRemoveCommandOptions = {}
): Promise<boolean> {
  if (options.yes) {
    return true
  }

  return promptConfirm(`确定删除 "${providerName}"?`, false)
}
