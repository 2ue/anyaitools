import { Command } from 'commander'
import { addCommand } from './add.js'
import { cloneCommand } from './clone.js'
import { currentCommand } from './current.js'
import { editCommand } from './edit.js'
import { listCommand } from './list.js'
import { removeCommand } from './remove.js'
import { useCommand } from './use.js'

export function createGrokCommands(program: Command): void {
  addCommand(program)
  listCommand(program)
  useCommand(program)
  currentCommand(program)
  editCommand(program)
  removeCommand(program)
  cloneCommand(program)
}

export function registerGrokCommands(program: Command): Command {
  const grok = program.command('grok').alias('gk').description('管理 xAI Grok Build 服务商')
  createGrokCommands(grok)
  return grok
}
