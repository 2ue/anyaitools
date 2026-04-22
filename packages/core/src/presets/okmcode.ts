export const OKMCODE_ROOT_URL = 'https://okmcode.com'

interface OkmcodePresetTemplate {
  name: string
  baseUrl: string
  description: string
}

type BaseUrlTransformer = (baseUrl: string) => string

export function createOkmcodePresets(
  transformBaseUrl: BaseUrlTransformer = (baseUrl) => baseUrl
): OkmcodePresetTemplate[] {
  return [
    {
      name: 'OKMCode',
      baseUrl: transformBaseUrl(OKMCODE_ROOT_URL),
      description: 'OKMCode 官方线路 (okmcode.com)',
    },
  ]
}
