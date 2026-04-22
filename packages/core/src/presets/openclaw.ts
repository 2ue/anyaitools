import type { InternalPresetTemplate } from '../tool-manager.types.js'
import { createOkmcodePresets } from './okmcode.js'

/**
 * OpenClaw 预置服务商
 */
export const OPENCLAW_PRESETS: InternalPresetTemplate[] = [
  ...createOkmcodePresets((baseUrl) => `${baseUrl}/v1`),
]
