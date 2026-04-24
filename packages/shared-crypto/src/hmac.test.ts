import { describe, expect, it } from 'vitest'
import { hmacSha256, hmacSha256Hex } from './hmac.js'

describe('hmac/sha256', () => {
  it('matches RFC 4231 test case 1', async () => {
    // Key: 20 bytes of 0x0b; data: "Hi There"
    const key = new Uint8Array(20).fill(0x0b)
    const out = await hmacSha256Hex(key, 'Hi There')
    expect(out).toBe('b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7')
  })

  it('matches RFC 4231 test case 2', async () => {
    // Key: "Jefe"; data: "what do ya want for nothing?"
    const out = await hmacSha256Hex('Jefe', 'what do ya want for nothing?')
    expect(out).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843')
  })

  it('returns a 32-byte signature', async () => {
    const out = await hmacSha256('secret', 'message')
    expect(out.length).toBe(32)
  })

  it('is deterministic for the same key and message', async () => {
    const a = await hmacSha256Hex('k', 'm')
    const b = await hmacSha256Hex('k', 'm')
    expect(a).toBe(b)
  })
})
