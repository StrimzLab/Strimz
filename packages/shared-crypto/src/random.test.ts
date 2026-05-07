import { describe, expect, it } from 'vitest'
import { randomBase64Url, randomBytes, randomHex, uuid } from './random.js'

describe('random/randomBytes', () => {
  it('returns the requested length', () => {
    expect(randomBytes(1).length).toBe(1)
    expect(randomBytes(16).length).toBe(16)
    expect(randomBytes(64).length).toBe(64)
  })

  it('rejects non-positive or non-integer inputs', () => {
    expect(() => randomBytes(0)).toThrow()
    expect(() => randomBytes(-1)).toThrow()
    expect(() => randomBytes(1.5)).toThrow()
  })

  it('produces different outputs on successive calls', () => {
    const a = randomBytes(32)
    const b = randomBytes(32)
    expect(a).not.toEqual(b)
  })
})

describe('random/randomHex', () => {
  it('returns 2 hex chars per byte', () => {
    expect(randomHex(16)).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('random/randomBase64Url', () => {
  it('returns a URL-safe string with no padding', () => {
    const out = randomBase64Url(32)
    expect(out).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

describe('random/uuid', () => {
  it('matches the RFC 4122 v4 format', () => {
    expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('produces distinct values', () => {
    expect(uuid()).not.toBe(uuid())
  })
})
