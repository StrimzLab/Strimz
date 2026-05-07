/**
 * API key generation and indexing.
 *
 * A key is `<prefix><random>` where random is base64url-encoded with 32 bytes
 * of entropy (256 bits). The backend stores:
 *   - prefix (for display)
 *   - last 4 chars (for display)
 *   - sha256(key) in lowercase hex (for O(1) lookup on every request)
 *
 * No salt is needed: the random portion has 256 bits of entropy and brute-
 * forcing SHA-256 preimages of uniformly random 256-bit values is infeasible.
 */

import {
  API_KEY_PREFIXES,
  API_KEY_RANDOM_BYTES,
  API_KEY_PREFIX_DISPLAY_LENGTH,
  type ApiKeyKind,
  type ApiKeyMode,
} from '@strimz/shared-config/api-keys'
import { sha256Hex } from './hash.js'
import { randomBase64Url } from './random.js'

export interface GeneratedApiKey {
  /** The full plaintext key — display once then discard. */
  secret: string
  /** Stored as the index. */
  hash: string
  /** Stored for display / log redaction. */
  prefix: string
  /** Stored for display — "my key ending in ...abcd". */
  lastFour: string
  kind: ApiKeyKind
  mode: ApiKeyMode
}

export async function generateApiKey(kind: ApiKeyKind, mode: ApiKeyMode): Promise<GeneratedApiKey> {
  const prefixStr = API_KEY_PREFIXES[kind][mode]
  const random = randomBase64Url(API_KEY_RANDOM_BYTES)
  const secret = `${prefixStr}${random}`
  const hash = await sha256Hex(secret)
  return {
    secret,
    hash,
    prefix: secret.slice(0, API_KEY_PREFIX_DISPLAY_LENGTH),
    lastFour: secret.slice(-4),
    kind,
    mode,
  }
}

export async function hashApiKey(secret: string): Promise<string> {
  return sha256Hex(secret)
}

export function redactApiKey(secret: string): string {
  if (secret.length <= API_KEY_PREFIX_DISPLAY_LENGTH + 4) {
    return '***'
  }
  return `${secret.slice(0, API_KEY_PREFIX_DISPLAY_LENGTH)}...${secret.slice(-4)}`
}
