import { describe, expect, it } from 'vitest'
import { generateApiKey, hashApiKey, redactApiKey } from './api-key.js'

describe('api-key/generateApiKey', () => {
  it('uses the right prefix for secret test keys', async () => {
    const k = await generateApiKey('secret', 'test')
    expect(k.secret.startsWith('sk_test_')).toBe(true)
    expect(k.kind).toBe('secret')
    expect(k.mode).toBe('test')
  })

  it('uses the right prefix for live publishable keys', async () => {
    const k = await generateApiKey('publishable', 'live')
    expect(k.secret.startsWith('pk_live_')).toBe(true)
  })

  it('records the hash of the full secret', async () => {
    const k = await generateApiKey('secret', 'test')
    expect(await hashApiKey(k.secret)).toBe(k.hash)
  })

  it('produces distinct secrets on successive calls', async () => {
    const a = await generateApiKey('secret', 'test')
    const b = await generateApiKey('secret', 'test')
    expect(a.secret).not.toBe(b.secret)
    expect(a.hash).not.toBe(b.hash)
  })

  it('records a display prefix and last four chars', async () => {
    const k = await generateApiKey('secret', 'test')
    expect(k.prefix.length).toBeGreaterThanOrEqual(8)
    expect(k.lastFour).toHaveLength(4)
    expect(k.secret.endsWith(k.lastFour)).toBe(true)
  })
})

describe('api-key/hashApiKey', () => {
  it('is deterministic', async () => {
    const a = await hashApiKey('sk_test_example')
    const b = await hashApiKey('sk_test_example')
    expect(a).toBe(b)
  })

  it('produces a 64-char lowercase hex string (32-byte sha256)', async () => {
    const hash = await hashApiKey('anything')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('api-key/redactApiKey', () => {
  it('shows prefix and last four only', () => {
    const out = redactApiKey('sk_test_abcdefghijklmnopqrstuvwxyz1234')
    expect(out).toBe('sk_test_abcd...1234')
  })

  it('hides very short keys entirely', () => {
    expect(redactApiKey('short')).toBe('***')
  })
})
