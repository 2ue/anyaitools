import type { EndpointCandidate } from './endpoint-latency.js'

export interface OkmcodeProfile {
  commandName: 'okmcode'
  title: string
  defaultProviderName: 'okmcode'
  endpointGroupLabel: string
  endpointGroupDescription: string
  baseUrls: EndpointCandidate[]
}

export const OKMCODE_PROFILE: OkmcodeProfile = {
  commandName: 'okmcode',
  title: 'okmcode',
  defaultProviderName: 'okmcode',
  endpointGroupLabel: 'okmcode 官方线路',
  endpointGroupDescription: '仅包含 okmcode.com 官方地址',
  baseUrls: [
    {
      label: 'okmcode 官方地址',
      url: 'https://okmcode.com',
      description: 'okmcode 官方入口',
    },
  ],
}

interface EndpointDisplayResult {
  label: string
  url: string
  latencyMs: number | null
  error?: string
}

export function getEndpointHost(url: string): string {
  return new URL(url).host
}

export function formatEndpointChoiceLabel(result: EndpointDisplayResult, index: number): string {
  const latencyText =
    result.latencyMs === null ? result.error || '测速失败' : `${result.latencyMs} ms`
  return `${index + 1}. ${result.label} | ${getEndpointHost(result.url)} | ${latencyText}`
}
