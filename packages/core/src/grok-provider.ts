import type { AddPresetInput, AddProviderInput, ApiBackend } from './tool-manager.types.js'

const API_BACKENDS: ApiBackend[] = ['chat_completions', 'responses', 'messages']

export function validateGrokProvider(provider: AddProviderInput): void {
  const configuredModel =
    typeof provider.modelConfig?.modelId === 'string' && provider.modelConfig.modelId.trim()
      ? provider.modelConfig.modelId
      : provider.model
  if (typeof configuredModel !== 'string' || !configuredModel.trim()) {
    throw new Error('Grok 模型不能为空')
  }
  if (typeof provider.baseUrl !== 'string') {
    throw new Error('Grok API 地址格式无效，仅支持 http(s) URL')
  }
  if (typeof provider.apiKey !== 'string') {
    throw new Error('Grok API Key 格式无效')
  }
  if (provider.apiBackend !== undefined && !API_BACKENDS.includes(provider.apiBackend)) {
    throw new Error(`不支持的 Grok API backend: ${String(provider.apiBackend)}`)
  }
  if (
    provider.supportsBackendSearch !== undefined &&
    typeof provider.supportsBackendSearch !== 'boolean'
  ) {
    throw new Error('Grok backend search 配置必须是布尔值')
  }

  if (!provider.baseUrl) {
    if (provider.apiKey) {
      throw new Error('Grok 内置模型不能配置 API Key')
    }
    return
  }

  try {
    const url = new URL(provider.baseUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('invalid protocol')
  } catch {
    throw new Error('Grok API 地址格式无效，仅支持 http(s) URL')
  }
}

export function validateGrokPreset(preset: AddPresetInput): void {
  validateGrokProvider({
    name: preset.name,
    baseUrl: preset.baseUrl,
    apiKey: '',
    model: preset.model,
    modelConfig: preset.modelConfig,
    apiBackend: preset.apiBackend,
    supportsBackendSearch: preset.supportsBackendSearch,
  })
}
