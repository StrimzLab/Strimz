import { uuid } from '@strimz/shared-crypto'

/**
 * Generate an idempotency key for a mutating SDK call.
 * Stripe convention: a UUID-like value with a stable prefix the merchant
 * can grep for in logs.
 */
export function generateIdempotencyKey(): string {
  return `strimz_${uuid()}`
}

/** RFC 4122 UUID-shaped, optionally with the strimz_ prefix. */
const IDEMPOTENCY_KEY_PATTERN =
  /^(strimz_)?[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

export function isValidIdempotencyKey(key: string): boolean {
  if (typeof key !== 'string') return false
  if (key.length > 255) return false
  return IDEMPOTENCY_KEY_PATTERN.test(key)
}
