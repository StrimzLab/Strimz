import { describe, expect, it } from 'vitest'

import { decryptAesGcm, encryptAesGcm, generateAesGcmKey } from './aes-gcm.js'

describe('aes-gcm', () => {
  it('round-trips an ASCII string', async () => {
    const key = generateAesGcmKey()
    const plaintext = 'whsec_abcdefghijklmnopqrstuvwxyz0123456789'
    const blob = await encryptAesGcm(plaintext, key)
    expect(await decryptAesGcm(blob, key)).toBe(plaintext)
  })

  it('round-trips a UTF-8 string with multi-byte characters', async () => {
    const key = generateAesGcmKey()
    const plaintext = 'Strimz — 🔐 secret · v2 · 你好'
    const blob = await encryptAesGcm(plaintext, key)
    expect(await decryptAesGcm(blob, key)).toBe(plaintext)
  })

  it('produces a different ciphertext for the same input each call (random nonce)', async () => {
    const key = generateAesGcmKey()
    const plaintext = 'identical input'
    const a = await encryptAesGcm(plaintext, key)
    const b = await encryptAesGcm(plaintext, key)
    expect(a).not.toBe(b)
    expect(await decryptAesGcm(a, key)).toBe(plaintext)
    expect(await decryptAesGcm(b, key)).toBe(plaintext)
  })

  it('starts every blob with the v1: version prefix', async () => {
    const blob = await encryptAesGcm('x', generateAesGcmKey())
    expect(blob.startsWith('v1:')).toBe(true)
  })

  it('refuses to decrypt with the wrong key', async () => {
    const blob = await encryptAesGcm('secret', generateAesGcmKey())
    const other = generateAesGcmKey()
    await expect(decryptAesGcm(blob, other)).rejects.toThrow()
  })

  it('refuses to decrypt a tampered ciphertext (auth-tag enforcement)', async () => {
    const key = generateAesGcmKey()
    const blob = await encryptAesGcm('untampered', key)
    // Flip the last hex digit of the ciphertext to corrupt it.
    const tampered = blob.replace(/[0-9a-f]$/, (last) => (last === '0' ? '1' : '0'))
    await expect(decryptAesGcm(tampered, key)).rejects.toThrow()
  })

  it('refuses to decrypt a blob with an unrecognised version prefix', async () => {
    const blob = (await encryptAesGcm('x', generateAesGcmKey())).replace(/^v1:/, 'v2:')
    await expect(decryptAesGcm(blob, generateAesGcmKey())).rejects.toThrow(/version prefix/)
  })

  it('refuses to decrypt a malformed blob (missing parts)', async () => {
    await expect(decryptAesGcm('v1:onlyonepart', generateAesGcmKey())).rejects.toThrow(/malformed/)
  })

  it('rejects non-hex keys', async () => {
    await expect(encryptAesGcm('x', 'not-hex-zzzz')).rejects.toThrow(/hex/)
  })

  it('rejects keys of wrong length', async () => {
    // 16 bytes (AES-128) instead of 32 (AES-256).
    const shortKey = '0'.repeat(32)
    await expect(encryptAesGcm('x', shortKey)).rejects.toThrow(/32 bytes/)
  })

  it('generateAesGcmKey produces 32-byte hex strings', () => {
    const key = generateAesGcmKey()
    expect(key).toMatch(/^[0-9a-f]{64}$/)
  })
})
