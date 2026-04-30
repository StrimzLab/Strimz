import { describe, it, expect } from 'vitest'
import { WebhookSigningService } from '../../src/infra/webhook-signing/signing.service.js'
import { hmacSha256Hex } from '@strimz/shared-crypto'

describe('WebhookSigningService', () => {
  const svc = new WebhookSigningService()

  it('produces t=…,v1=… header at fixed time', async () => {
    const header = await svc.buildSignatureHeader('secret', '{"a":1}', 1_700_000_000_000)
    const ts = '1700000000'
    const expected = `t=${ts},v1=${await hmacSha256Hex('secret', `${ts}.{"a":1}`)}`
    expect(header).toBe(expected)
  })

  it('produces different signatures when bodies differ', async () => {
    const at = 1_700_000_000_000
    const a = await svc.buildSignatureHeader('s', 'a', at)
    const b = await svc.buildSignatureHeader('s', 'b', at)
    expect(a).not.toBe(b)
  })
})
