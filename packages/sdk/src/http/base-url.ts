import type { ApiKeyMode } from '@strimz/shared-config'

const BASE_URLS: Record<ApiKeyMode, string> = {
  test: 'https://api-test.strimz.finance',
  live: 'https://api.strimz.finance',
}

export function defaultBaseUrl(mode: ApiKeyMode): string {
  return BASE_URLS[mode]
}
