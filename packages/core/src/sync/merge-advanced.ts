/**
 * 智能合并逻辑
 *
 * 合并规则：
 * 1. Provider 相同判断：端点、凭证、模型与协议能力相同 = 同一配置
 * 2. Preset 相同判断：端点、模型与协议能力相同 = 同一配置
 * 3. 相同配置：使用云端数据（覆盖本地）
 * 4. 不同配置：都保留
 * 5. name 冲突：自动重命名为 name_2, name_3 ...
 */

import type { Provider } from '../tool-manager.js'
import type { ApiBackend } from '../tool-manager.types.js'

/**
 * 合并结果
 */
export interface MergeResult {
  /** 合并后的 provider 列表 */
  merged: Provider[]
  /** 是否有变化 */
  hasChanges: boolean
}

/**
 * 判断两个 provider 是否为相同配置
 * 规则：baseUrl + apiKey + model + apiBackend + supportsBackendSearch 相同 = 同一配置
 *
 * @param a - Provider A
 * @param b - Provider B
 * @returns 是否相同配置
 */
function isSameConfig(a: Provider, b: Provider): boolean {
  return (
    a.baseUrl === b.baseUrl &&
    a.apiKey === b.apiKey &&
    a.model === b.model &&
    a.apiBackend === b.apiBackend &&
    a.supportsBackendSearch === b.supportsBackendSearch
  )
}

/**
 * 判断两个 provider 是否完全相同（所有字段）
 *
 * @param a - Provider A
 * @param b - Provider B
 * @returns 是否完全相同
 */
export function isProviderEqual(a: Provider, b: Provider): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.baseUrl === b.baseUrl &&
    a.apiKey === b.apiKey &&
    a.model === b.model &&
    a.apiBackend === b.apiBackend &&
    a.supportsBackendSearch === b.supportsBackendSearch
  )
}

/**
 * 解决 name 冲突
 * 如果 name 已存在，自动重命名为 name_2, name_3 ...
 *
 * @param existingProviders - 已有的 provider 列表
 * @param newProvider - 新的 provider
 * @returns 重命名后的 provider
 */
function resolveNameConflict(existingProviders: Provider[], newProvider: Provider): Provider {
  const existingNames = new Set(existingProviders.map((p) => p.name))

  // 如果名称不冲突，直接返回
  if (!existingNames.has(newProvider.name)) {
    return newProvider
  }

  // 寻找可用的后缀数字
  let suffix = 2
  let newName = `${newProvider.name}_${suffix}`

  while (existingNames.has(newName)) {
    suffix++
    newName = `${newProvider.name}_${suffix}`
  }

  console.log(`name 冲突：将 "${newProvider.name}" 重命名为 "${newName}"`)

  return {
    ...newProvider,
    name: newName,
  }
}

/**
 * 智能合并两个 provider 列表
 *
 * 合并逻辑：
 * 1. 相同配置（baseUrl + apiKey）：使用云端数据
 * 2. 不同配置：都保留
 *
 * @param local - 本地 provider 列表
 * @param remote - 远程 provider 列表
 * @returns 合并结果
 */
export function mergeProviders(local: Provider[], remote: Provider[]): MergeResult {
  // 用于存储合并结果
  const mergedMap = new Map<string, Provider>()
  let hasChanges = false

  // 步骤1：添加所有本地 providers（作为基础）
  for (const localProvider of local) {
    mergedMap.set(localProvider.id, localProvider)
  }

  // 步骤2：处理远程 providers
  for (const remoteProvider of remote) {
    // 查找本地是否有相同配置（baseUrl + apiKey）
    const existingLocal = Array.from(mergedMap.values()).find((p) =>
      isSameConfig(p, remoteProvider)
    )

    if (existingLocal) {
      // 相同配置 → 使用云端数据（覆盖本地）
      mergedMap.delete(existingLocal.id)
      mergedMap.set(remoteProvider.id, remoteProvider)

      // 检查是否有实际变化
      if (!isProviderEqual(existingLocal, remoteProvider)) {
        hasChanges = true
        console.log(`相同配置 (${remoteProvider.baseUrl})，使用云端数据`)
      }
    } else {
      // 不同配置 → 添加云端 provider（name 冲突时重命名）
      const existingProviders = Array.from(mergedMap.values())
      const resolvedProvider = resolveNameConflict(existingProviders, remoteProvider)

      mergedMap.set(resolvedProvider.id, resolvedProvider)
      hasChanges = true
      console.log(`新 provider ${resolvedProvider.name}，添加到合并列表`)
    }
  }

  // 转换为数组
  const merged = Array.from(mergedMap.values())

  return {
    merged,
    hasChanges,
  }
}

/**
 * 检查两个 provider 列表是否完全相同
 *
 * @param local - 本地 provider 列表
 * @param remote - 远程 provider 列表
 * @returns 是否完全相同
 */
/**
 * Preset 类型定义
 */
export interface Preset {
  name: string
  baseUrl: string
  description: string
  model?: string
  apiBackend?: ApiBackend
  supportsBackendSearch?: boolean
}

function getPresetConfigKey(preset: Preset): string {
  return JSON.stringify([
    preset.baseUrl,
    preset.model || '',
    preset.apiBackend || 'chat_completions',
    preset.supportsBackendSearch ?? false,
  ])
}

/**
 * 解决 preset name 冲突
 */
function resolvePresetNameConflict(existingPresets: Preset[], newPreset: Preset): Preset {
  const existingNames = new Set(existingPresets.map((p) => p.name))

  if (!existingNames.has(newPreset.name)) {
    return newPreset
  }

  let suffix = 2
  let newName = `${newPreset.name}_${suffix}`

  while (existingNames.has(newName)) {
    suffix++
    newName = `${newPreset.name}_${suffix}`
  }

  console.log(`preset name 冲突：将 "${newPreset.name}" 重命名为 "${newName}"`)

  return {
    ...newPreset,
    name: newName,
  }
}

/**
 * 智能合并两个 preset 列表
 *
 * 合并逻辑：
 * 1. 相同 preset（端点、模型与协议能力相同）：使用云端数据
 * 2. 不同 preset：都保留
 *
 * @param local - 本地 preset 列表
 * @param remote - 远程 preset 列表
 * @returns 合并后的 preset 列表
 */
export function mergePresets(local: Preset[] | undefined, remote: Preset[] | undefined): Preset[] {
  const localPresets = local || []
  const remotePresets = remote || []

  // 用于存储合并结果（key: URL + model + backend + backend search）
  const mergedMap = new Map<string, Preset>()

  // 步骤1：添加本地 presets
  for (const preset of localPresets) {
    mergedMap.set(getPresetConfigKey(preset), preset)
  }

  // 步骤2：处理远程 presets
  for (const remotePreset of remotePresets) {
    const configKey = getPresetConfigKey(remotePreset)
    const existingLocal = mergedMap.get(configKey)

    if (existingLocal) {
      // 相同 baseUrl → 使用云端数据（覆盖本地）
      mergedMap.set(configKey, remotePreset)
      console.log(`preset ${remotePreset.name} (${remotePreset.baseUrl})，使用云端数据`)
    } else {
      // 不同 baseUrl → 添加云端 preset（name 冲突时重命名）
      const existingPresets = Array.from(mergedMap.values())
      const resolvedPreset = resolvePresetNameConflict(existingPresets, remotePreset)

      mergedMap.set(configKey, resolvedPreset)
    }
  }

  return Array.from(mergedMap.values())
}

export function areProvidersEqual(local: Provider[], remote: Provider[]): boolean {
  if (local.length !== remote.length) {
    return false
  }

  // 按 id 排序后比较
  const localSorted = [...local].sort((a, b) => a.id.localeCompare(b.id))
  const remoteSorted = [...remote].sort((a, b) => a.id.localeCompare(b.id))

  for (let i = 0; i < localSorted.length; i++) {
    if (!isProviderEqual(localSorted[i], remoteSorted[i])) {
      return false
    }
  }

  return true
}
