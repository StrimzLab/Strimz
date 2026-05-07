import { describe, expect, it } from 'vitest'
import { WEBHOOK_SIGNATURE_VERSION, signWebhookPayload, verifyWebhookSignature } from './webhook.js'

const SECRET = 'whsec_test_1234567890abcdef'
const PAYLOAD = '{"type":"payment.completed","data":{"amount":"1000000"}}'
const T = 1_735_000_000

describe('webhook/signWebhookPayload', () => {
  it('produces the expected header format', async () => {
    const header = await signWebhookPayload(PAYLOAD, SECRET, { timestampSeconds: T })
    expect(header).toMatch(new RegExp(`^t=${T},${WEBHOOK_SIGNATURE_VERSION}=[a-f0-9]{64}$`))
  })

  it('uses the provided timestamp', async () => {
    const header = await signWebhookPayload(PAYLOAD, SECRET, { timestampSeconds: 42 })
    expect(header.startsWith('t=42,')).toBe(true)
  })
})

describe('webhook/verifyWebhookSignature', () => {
  it('accepts a well-formed, current signature', async () => {
    const header = await signWebhookPayload(PAYLOAD, SECRET, { timestampSeconds: T })
    const result = await verifyWebhookSignature(PAYLOAD, header, SECRET, { nowSeconds: T })
    expect(result).toEqual({ valid: true })
  })

  it('rejects a signature with a different payload', async () => {
    const header = await signWebhookPayload(PAYLOAD, SECRET, { timestampSeconds: T })
    const result = await verifyWebhookSignature(`${PAYLOAD}x`, header, SECRET, { nowSeconds: T })
    expect(result).toEqual({ valid: false, reason: 'signature_mismatch' })
  })

  it('rejects a signature with a different secret', async () => {
    const header = await signWebhookPayload(PAYLOAD, SECRET, { timestampSeconds: T })
    const result = await verifyWebhookSignature(PAYLOAD, header, `${SECRET}x`, { nowSeconds: T })
    expect(result).toEqual({ valid: false, reason: 'signature_mismatch' })
  })

  it('rejects a stale timestamp outside the tolerance window', async () => {
    const header = await signWebhookPayload(PAYLOAD, SECRET, { timestampSeconds: T })
    const result = await verifyWebhookSignature(PAYLOAD, header, SECRET, {
      nowSeconds: T + 3_600,
      toleranceSeconds: 300,
    })
    expect(result).toEqual({ valid: false, reason: 'timestamp_out_of_range' })
  })

  it('rejects a future timestamp outside the tolerance window', async () => {
    const header = await signWebhookPayload(PAYLOAD, SECRET, { timestampSeconds: T + 3_600 })
    const result = await verifyWebhookSignature(PAYLOAD, header, SECRET, {
      nowSeconds: T,
      toleranceSeconds: 300,
    })
    expect(result).toEqual({ valid: false, reason: 'timestamp_out_of_range' })
  })

  it('rejects a missing-timestamp header', async () => {
    const result = await verifyWebhookSignature(PAYLOAD, 'v1=abc', SECRET, { nowSeconds: T })
    expect(result).toEqual({ valid: false, reason: 'missing_timestamp' })
  })

  it('rejects a missing-signature header', async () => {
    const result = await verifyWebhookSignature(PAYLOAD, `t=${T}`, SECRET, { nowSeconds: T })
    expect(result).toEqual({ valid: false, reason: 'missing_signature' })
  })

  it('rejects a malformed header', async () => {
    const result = await verifyWebhookSignature(PAYLOAD, 'garbage', SECRET, { nowSeconds: T })
    expect(result).toEqual({ valid: false, reason: 'malformed_header' })
  })

  it('rejects a non-hex signature', async () => {
    const result = await verifyWebhookSignature(PAYLOAD, `t=${T},v1=nothexanywhere`, SECRET, {
      nowSeconds: T,
    })
    expect(result.valid).toBe(false)
  })
})
