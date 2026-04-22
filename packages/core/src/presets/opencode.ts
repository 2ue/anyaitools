import type { InternalPresetTemplate } from '../tool-manager.types.js'
import { createOkmcodePresets } from './okmcode.js'

/**
 * OpenCode 预置服务商
 */
export const OPENCODE_PRESETS: InternalPresetTemplate[] = [...createOkmcodePresets()]
