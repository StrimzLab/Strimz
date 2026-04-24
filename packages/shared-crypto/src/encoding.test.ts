import { describe, expect, it } from 'vitest'
import { bytesToUtf8, fromHex, toBase64Url, toHex, utf8ToBytes } from './encoding.js'

describe('encoding/hex', () => {
  it('round-trips through toHex → fromHex', () => {
    const bytes = new Uint8Array([0, 1, 2, 254, 255, 127, 128])
    const hex = toHex(bytes)
    expect(hex).toBe('000102feff7f80')
    expect(fromHex(hex)).toEqual(bytes)
  })

  it('accepts an optional 0x prefix on fromHex', () => {
    expect(fromHex('0xdeadbeef')).toEqual(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))
  })

  it('rejects odd-length hex', () => {
    expect(() => fromHex('abc')).toThrow('odd-length')
  })

  it('rejects non-hex characters', () => {
    expect(() => fromHex('xy')).toThrow('non-hex')
  })

  it('produces lowercase hex', () => {
    expect(toHex(new Uint8Array([0xab, 0xcd]))).toBe('abcd')
  })
})

describe('encoding/base64url', () => {
  it('encodes without padding and with URL-safe characters', () => {
    // Bytes chosen so stdlib base64 would emit + / =
    const bytes = new Uint8Array([0xfb, 0xff, 0xbf])
    const out = toBase64Url(bytes)
    expect(out).not.toContain('+')
    expect(out).not.toContain('/')
    expect(out).not.toContain('=')
  })

  it('encodes empty input to empty string', () => {
    expect(toBase64Url(new Uint8Array(0))).toBe('')
  })
})

describe('encoding/utf8', () => {
  it('round-trips through utf8ToBytes → bytesToUtf8', () => {
    const s = 'hello — world 🌍'
    expect(bytesToUtf8(utf8ToBytes(s))).toBe(s)
  })
})
