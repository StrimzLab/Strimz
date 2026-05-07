import { describe, expect, it } from 'vitest'
import { timingSafeEqualBytes, timingSafeEqualString } from './timing-safe.js'

describe('timing-safe/bytes', () => {
  it('returns true for equal byte arrays', () => {
    const a = new Uint8Array([1, 2, 3])
    const b = new Uint8Array([1, 2, 3])
    expect(timingSafeEqualBytes(a, b)).toBe(true)
  })

  it('returns false for arrays of different length', () => {
    expect(timingSafeEqualBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3, 4]))).toBe(
      false,
    )
  })

  it('returns false for arrays that differ in any byte', () => {
    expect(timingSafeEqualBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false)
  })

  it('handles empty arrays', () => {
    expect(timingSafeEqualBytes(new Uint8Array(0), new Uint8Array(0))).toBe(true)
  })
})

describe('timing-safe/string', () => {
  it('returns true for equal strings', () => {
    expect(timingSafeEqualString('abc', 'abc')).toBe(true)
  })

  it('returns false for different-length strings', () => {
    expect(timingSafeEqualString('abc', 'abcd')).toBe(false)
  })

  it('returns false for equal-length strings that differ', () => {
    expect(timingSafeEqualString('abc', 'abd')).toBe(false)
  })
})
