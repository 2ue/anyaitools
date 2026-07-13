import type { InternalPresetTemplate } from '../tool-manager.types.js'

/**
 * xAI 官方 Grok Build 预设。
 *
 * 这些值只是表单默认值；writer 始终原样写入用户保存的配置，
 * 不会根据域名推断 API backend 或修改 URL。
 */
export const GROK_PRESETS: InternalPresetTemplate[] = [
  {
    name: 'xAI Grok Build',
    baseUrl: '',
    description: 'xAI 官方内置 Grok Build 模型',
    model: 'grok-build',
  },
]
