/**
 * API key prefix conventions.
 *
 * Prefix tells you immediately which environment a key targets and whether it
 * is safe to expose to the client. Secret keys are server-side only; publishable
 * keys can ship in browser bundles.
 */

export type ApiKeyMode = 'test' | 'live'
export type ApiKeyKind = 'secret' | 'publishable'

export const API_KEY_PREFIXES = {
  secret: {
    test: 'sk_test_',
    live: 'sk_live_',
  },
  publishable: {
    test: 'pk_test_',
    live: 'pk_live_',
  },
} as const satisfies Record<ApiKeyKind, Record<ApiKeyMode, string>>

/** Length of the random portion of a key, before prefix. Base62, 256 bits of entropy. */
export const API_KEY_RANDOM_BYTES = 32

export function prefixFor(kind: ApiKeyKind, mode: ApiKeyMode): string {
  return API_KEY_PREFIXES[kind][mode]
}

export function modeFromKey(key: string): ApiKeyMode | null {
  if (key.startsWith('sk_test_') || key.startsWith('pk_test_')) return 'test'
  if (key.startsWith('sk_live_') || key.startsWith('pk_live_')) return 'live'
  return null
}

export function kindFromKey(key: string): ApiKeyKind | null {
  if (key.startsWith('sk_')) return 'secret'
  if (key.startsWith('pk_')) return 'publishable'
  return null
}

/** Number of leading characters of a key safe to display in dashboards/logs. */
export const API_KEY_PREFIX_DISPLAY_LENGTH = 12
