import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveProviderAddInput, resolveProviderEditInput } from './provider-params.js'

const presets = [
  {
    name: 'OKMCode',
    baseUrl: 'https://okmcode.com',
    description: 'OKMCode 主站',
    isBuiltIn: true,
  },
]

test('resolveProviderAddInput should build non-interactive preset input', () => {
  const resolved = resolveProviderAddInput(
    {
      preset: 'okmcode',
      apiKey: 'sk-test',
      switch: true,
    },
    presets
  )

  assert.equal(resolved.nonInteractive, true)
  assert.equal(resolved.switchNow, true)
  assert.deepEqual(resolved.input, {
    name: 'OKMCode',
    desc: undefined,
    baseUrl: 'https://okmcode.com',
    apiKey: 'sk-test',
  })
})

test('resolveProviderAddInput should allow empty Gemini values', () => {
  const resolved = resolveProviderAddInput(
    {
      name: 'Gemini Default',
      baseUrl: '',
      apiKey: '',
    },
    [],
    {
      allowEmptyBaseUrl: true,
      allowEmptyApiKey: true,
    }
  )

  assert.equal(resolved.nonInteractive, true)
  assert.deepEqual(resolved.input, {
    name: 'Gemini Default',
    desc: undefined,
    baseUrl: '',
    apiKey: '',
  })
})

test('resolveProviderAddInput should reject missing required fields', () => {
  assert.throws(() =>
    resolveProviderAddInput(
      {
        name: 'Broken',
      },
      []
    )
  )
})

test('resolveProviderEditInput should preserve explicit empty desc', () => {
  const resolved = resolveProviderEditInput({
    newName: 'Renamed',
    desc: '',
    baseUrl: 'https://api.example.com',
    apiKey: 'sk-updated',
  })

  assert.equal(resolved.nonInteractive, true)
  assert.deepEqual(resolved.updates, {
    name: 'Renamed',
    desc: '',
    baseUrl: 'https://api.example.com',
    apiKey: 'sk-updated',
  })
})

test('resolveProviderEditInput should allow empty Gemini baseUrl and apiKey', () => {
  const resolved = resolveProviderEditInput(
    {
      baseUrl: '',
      apiKey: '',
    },
    {
      allowEmptyBaseUrl: true,
      allowEmptyApiKey: true,
    }
  )

  assert.deepEqual(resolved.updates, {
    baseUrl: '',
    apiKey: '',
  })
})

test('resolveProviderAddInput should carry Grok preset model capabilities', () => {
  const resolved = resolveProviderAddInput(
    {
      preset: 'xAI Grok Build',
      apiKey: '',
      switch: true,
    },
    [
      {
        name: 'xAI Grok Build',
        baseUrl: '',
        model: 'grok-build',
        apiBackend: 'responses',
        supportsBackendSearch: true,
      },
    ],
    {
      allowEmptyApiKey: true,
      allowEmptyPresetBaseUrl: true,
      requireModel: true,
      defaultApiBackend: 'chat_completions',
      defaultSupportsBackendSearch: false,
    }
  )

  assert.equal(resolved.switchNow, true)
  assert.deepEqual(resolved.input, {
    name: 'xAI Grok Build',
    desc: undefined,
    baseUrl: '',
    apiKey: '',
    model: 'grok-build',
    apiBackend: 'responses',
    supportsBackendSearch: true,
  })
})

test('resolveProviderAddInput should still reject an empty custom Grok URL', () => {
  assert.throws(
    () =>
      resolveProviderAddInput(
        {
          name: 'Custom Grok',
          baseUrl: '',
          apiKey: '',
          model: 'custom-model',
        },
        [],
        {
          allowEmptyApiKey: true,
          allowEmptyPresetBaseUrl: true,
          requireModel: true,
        }
      ),
    /--base-url/
  )
})

test('resolveProviderAddInput should apply Grok custom provider defaults', () => {
  const resolved = resolveProviderAddInput(
    {
      name: 'Compatible API',
      baseUrl: 'https://gateway.example.test/custom',
      apiKey: '',
      model: 'example-model',
    },
    [],
    {
      allowEmptyApiKey: true,
      requireModel: true,
      defaultApiBackend: 'chat_completions',
      defaultSupportsBackendSearch: false,
    }
  )

  assert.deepEqual(resolved.input, {
    name: 'Compatible API',
    desc: undefined,
    baseUrl: 'https://gateway.example.test/custom',
    apiKey: '',
    model: 'example-model',
    apiBackend: 'chat_completions',
    supportsBackendSearch: false,
  })
})

test('resolveProviderAddInput should require a model when requested', () => {
  assert.throws(
    () =>
      resolveProviderAddInput(
        {
          name: 'Missing Model',
          baseUrl: 'https://api.example.test',
          apiKey: '',
        },
        [],
        {
          allowEmptyApiKey: true,
          requireModel: true,
        }
      ),
    /--model/
  )
})

test('resolveProviderAddInput should reject an unknown API backend', () => {
  assert.throws(
    () =>
      resolveProviderAddInput(
        {
          name: 'Broken Backend',
          baseUrl: 'https://api.example.test',
          apiKey: '',
          model: 'example-model',
          apiBackend: 'unknown' as 'responses',
        },
        [],
        {
          allowEmptyApiKey: true,
          requireModel: true,
        }
      ),
    /API Backend/
  )
})

test('resolveProviderEditInput should update Grok model capabilities', () => {
  const resolved = resolveProviderEditInput(
    {
      model: 'grok-build',
      apiBackend: 'responses',
      supportsBackendSearch: false,
      apiKey: '',
    },
    { allowEmptyApiKey: true }
  )

  assert.equal(resolved.nonInteractive, true)
  assert.deepEqual(resolved.updates, {
    apiKey: '',
    model: 'grok-build',
    apiBackend: 'responses',
    supportsBackendSearch: false,
  })
})

test('resolveProviderAddInput should preserve structured reasoning options', () => {
  const resolved = resolveProviderAddInput(
    {
      name: 'Gemini Reasoning',
      baseUrl: 'https://api.example.test',
      apiKey: 'sk-test',
      model: 'gemini-model',
      thinkingBudget: 4096,
      showThinking: true,
    },
    []
  )

  assert.deepEqual(resolved.input?.modelConfig, {
    modelId: 'gemini-model',
    source: 'manual',
    reasoning: {
      mode: 'budget',
      value: 4096,
      visible: true,
    },
  })
})
