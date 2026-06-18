import { describe, expect, it } from 'vitest'

import { bytesToHex, fromBase64Url, toBase64Url } from './bytes.js'

describe('toBase64Url / fromBase64Url', () => {
  it('round-trips ASCII bytes', () => {
    const input = new TextEncoder().encode('strimz')
    const b64 = toBase64Url(input)
    const decoded = fromBase64Url(b64)
    expect(new TextDecoder().decode(decoded)).toBe('strimz')
  })

  it('strips trailing padding', () => {
    const input = new Uint8Array([1, 2, 3])
    const b64 = toBase64Url(input)
    expect(b64).not.toMatch(/=$/)
  })

  it('uses URL-safe alphabet (no + or /)', () => {
    // 0xfb 0xff produces `+` and `/` characters in standard base64.
    const input = new Uint8Array([0xfb, 0xff, 0xff])
    const b64 = toBase64Url(input)
    expect(b64).not.toContain('+')
    expect(b64).not.toContain('/')
  })

  it('round-trips arbitrary binary input', () => {
    const input = new Uint8Array(64)
    for (let i = 0; i < input.length; i++) input[i] = (i * 73) & 0xff
    const round = fromBase64Url(toBase64Url(input))
    expect(round).toEqual(input)
  })
})

describe('bytesToHex', () => {
  it('encodes single-digit bytes with a leading zero', () => {
    expect(bytesToHex(new Uint8Array([0x00, 0x0a, 0xff]))).toBe('000aff')
  })

  it('returns an empty string for an empty input', () => {
    expect(bytesToHex(new Uint8Array())).toBe('')
  })
})
