import { describe, it, expect } from 'vitest'
import { generateIdempotencyKey, isValidIdempotencyKey } from '../src/idempotency.js'

describe('idempotency', () => {
  it('generates a key with the strimz_ prefix and a UUID v4', () => {
    const k = generateIdempotencyKey()
    expect(k.startsWith('strimz_')).toBe(true)
    expect(isValidIdempotencyKey(k)).toBe(true)
  })

  it('produces distinct keys', () => {
    expect(generateIdempotencyKey()).not.toBe(generateIdempotencyKey())
  })

  it('accepts plain UUID v4 (without prefix)', () => {
    expect(isValidIdempotencyKey('a1b2c3d4-1234-4abc-8def-0123456789ab')).toBe(true)
  })

  it('rejects garbage', () => {
    expect(isValidIdempotencyKey('not-a-uuid')).toBe(false)
    expect(isValidIdempotencyKey('')).toBe(false)
    expect(isValidIdempotencyKey('strimz_short')).toBe(false)
  })
})
