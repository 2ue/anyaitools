import assert from 'node:assert/strict'
import test from 'node:test'

import { OKMCODE_PROFILE, formatEndpointChoiceLabel, getEndpointHost } from './okmcode-endpoints.js'

test('OKMCode should only include okmcode.com endpoint', () => {
  assert.equal(OKMCODE_PROFILE.defaultProviderName, 'okmcode')
  assert.deepEqual(
    OKMCODE_PROFILE.baseUrls.map((item) => item.url),
    ['https://okmcode.com']
  )
  assert.ok(OKMCODE_PROFILE.baseUrls.every((item) => item.url.includes('okmcode.com')))
})

test('endpoint choice label should use a compact numbered format', () => {
  assert.equal(getEndpointHost('https://okmcode.com'), 'okmcode.com')

  assert.equal(
    formatEndpointChoiceLabel(
      {
        label: 'OKMCode 官方地址',
        url: 'https://okmcode.com',
        latencyMs: 42,
      },
      0
    ),
    '1. OKMCode 官方地址 | okmcode.com | 42 ms'
  )

  assert.equal(
    formatEndpointChoiceLabel(
      {
        label: 'OKMCode 官方地址',
        url: 'https://okmcode.com',
        latencyMs: null,
        error: '测速超时',
      },
      0
    ),
    '1. OKMCode 官方地址 | okmcode.com | 测速超时'
  )
})
