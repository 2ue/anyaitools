import type { Provider, ToolModelConfig } from '@anyaitools/types'

export function resolveProviderModel(
  provider: Pick<Provider, 'model' | 'modelConfig'>,
  fallback: string
): string {
  const legacyModel = provider.model?.trim()
  // Gemini 的旧 JSON 元数据（defaultModel/env）仍由 Gemini writer 单独解析；
  // 通用解析器不能把整段 metadata 或 defaultModel 提前当成已选模型，
  // 否则会覆盖 merge 模式下用户现有的 GEMINI_MODEL。
  const selected =
    provider.modelConfig?.modelId?.trim() ||
    (legacyModel && !legacyModel.startsWith('{') ? legacyModel : undefined)
  return selected || fallback
}

export function resolveProviderVariant(
  provider: Pick<Provider, 'modelConfig'>
): string | undefined {
  const variant = provider.modelConfig?.variant
  return typeof variant === 'string' && variant.trim() ? variant.trim() : undefined
}

export function resolveProviderReasoning(
  provider: Pick<Provider, 'modelConfig'>
): ToolModelConfig['reasoning'] | undefined {
  return provider.modelConfig?.reasoning
}

export function resolveProviderParameters(
  provider: Pick<Provider, 'modelConfig'>
): Record<string, unknown> {
  return provider.modelConfig?.parameters || {}
}
