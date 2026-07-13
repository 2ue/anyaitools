import assert from 'node:assert/strict'
import test from 'node:test'
import { Command } from 'commander'

import { addProviderAddOptions, addProviderEditOptions } from '../../utils/provider-params.js'
import { registerGrokCommands } from './index.js'

function optionNames(command: Command): string[] {
  return command.options
    .map((option) => option.long)
    .filter((name): name is string => Boolean(name))
}

test('registerGrokCommands registers the root alias and complete command set', () => {
  const program = new Command()
  const grok = registerGrokCommands(program)

  assert.equal(grok.name(), 'grok')
  assert.deepEqual(grok.aliases(), ['gk'])
  assert.deepEqual(
    grok.commands.map((command) => command.name()),
    ['add', 'list', 'use', 'current', 'edit', 'remove', 'clone']
  )

  const add = grok.commands.find((command) => command.name() === 'add')
  const edit = grok.commands.find((command) => command.name() === 'edit')
  assert.ok(add)
  assert.ok(edit)
  assert.ok(optionNames(add).includes('--model'))
  assert.ok(optionNames(add).includes('--api-backend'))
  assert.ok(optionNames(edit).includes('--supports-backend-search'))
  assert.ok(optionNames(edit).includes('--no-supports-backend-search'))
})

test('Commander parses Grok model options and both backend-search flags', () => {
  const positive = new Command('add')
  addProviderAddOptions(positive, { modelConfig: true })
  positive.parseOptions([
    '--model',
    'grok-build',
    '--api-backend',
    'responses',
    '--supports-backend-search',
  ])
  assert.deepEqual(positive.opts(), {
    model: 'grok-build',
    apiBackend: 'responses',
    supportsBackendSearch: true,
  })

  const negative = new Command('edit')
  addProviderEditOptions(negative, { modelConfig: true })
  negative.parseOptions(['--no-supports-backend-search'])
  assert.deepEqual(negative.opts(), { supportsBackendSearch: false })
})

test('shared provider commands do not register Grok-only options by default', () => {
  const add = new Command('add')
  const edit = new Command('edit')
  addProviderAddOptions(add)
  addProviderEditOptions(edit)

  for (const command of [add, edit]) {
    const names = optionNames(command)
    assert.equal(names.includes('--model'), false)
    assert.equal(names.includes('--api-backend'), false)
    assert.equal(names.includes('--supports-backend-search'), false)
    assert.equal(names.includes('--no-supports-backend-search'), false)
  }
})
