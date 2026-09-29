import { describe, expect, it } from 'vitest'
import { outboxRefSchema, readOutboxRef } from '../../src/infra/webhook-outbox/outbox-ref.js'

describe('outbox ref payloads', () => {
  it('reads the ref the Go indexer writes', () => {
    const payload = JSON.parse(
      '{"ref":{"kind":"invoice.paid","invoiceId":"inv_1","transactionId":"tx_1"}}',
    ) as unknown
    expect(outboxRefSchema.parse(readOutboxRef(payload))).toEqual({
      kind: 'invoice.paid',
      invoiceId: 'inv_1',
      transactionId: 'tx_1',
    })
  })

  it('keeps the optional reason on payment.failed', () => {
    const ref = outboxRefSchema.parse({
      kind: 'payment.failed',
      sessionId: 'ps_1',
      reason: 'session expired',
    })
    expect(ref).toMatchObject({ kind: 'payment.failed', reason: 'session expired' })
  })

  it('treats a full envelope as having no ref', () => {
    expect(readOutboxRef({ id: 'evt_1', type: 'payment.completed', data: {} })).toBeUndefined()
    expect(readOutboxRef(null)).toBeUndefined()
    expect(readOutboxRef('text')).toBeUndefined()
  })

  it('rejects an unknown kind and a missing id', () => {
    expect(outboxRefSchema.safeParse({ kind: 'payout.sent', payoutId: 'p_1' }).success).toBe(false)
    expect(outboxRefSchema.safeParse({ kind: 'refund.completed' }).success).toBe(false)
  })
})
