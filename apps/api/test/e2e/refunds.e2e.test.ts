import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedApiKey, seedMerchant, seedTransaction } from '../helpers/fixtures.js'

describe('refunds e2e', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
  })

  it('creates a refund and returns wallet-signing instructions', async () => {
    const m = await seedMerchant(t.prisma.db)
    const tx = await seedTransaction(t.prisma.db, m.id, { amount: '100000000' })
    const k = await seedApiKey(t.prisma.db, m.id)

    const res = await t.inject({
      method: 'POST',
      url: '/v1/refunds',
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: {
        transactionId: tx.id,
        amount: '40000000',
        reason: 'customer_request',
      },
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body.refund.status).toBe('awaiting_signature')
    expect(body.refund.amount).toBe('40000000')
    expect(body.signingInstructions.to).toBe(tx.payerAddress)
    expect(body.signingInstructions.amount).toBe('40000000')
  })

  it('rejects refunds when transaction is not confirmed', async () => {
    const m = await seedMerchant(t.prisma.db)
    const tx = await seedTransaction(t.prisma.db, m.id, { status: 'pending' })
    const k = await seedApiKey(t.prisma.db, m.id)
    const res = await t.inject({
      method: 'POST',
      url: '/v1/refunds',
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: { transactionId: tx.id, amount: '10000000', reason: 'duplicate_charge' },
    })
    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body).error.code).toBe('session_invalid_state')
  })

  it('enforces cumulative refund cap', async () => {
    const m = await seedMerchant(t.prisma.db)
    const tx = await seedTransaction(t.prisma.db, m.id, { amount: '100000000' })
    const k = await seedApiKey(t.prisma.db, m.id)

    const r1 = await t.inject({
      method: 'POST',
      url: '/v1/refunds',
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: { transactionId: tx.id, amount: '60000000', reason: 'customer_request' },
    })
    expect(r1.statusCode).toBe(201)
    // Mark first refund as submitted so it counts toward the cap.
    const firstRefundId = JSON.parse(r1.body).refund.id
    await t.prisma.db.refund.update({
      where: { id: firstRefundId },
      data: { status: 'submitted', refundTxHash: '0x' + 'a'.repeat(64) },
    })

    const r2 = await t.inject({
      method: 'POST',
      url: '/v1/refunds',
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: { transactionId: tx.id, amount: '50000000', reason: 'customer_request' },
    })
    expect(r2.statusCode).toBe(400)
    expect(JSON.parse(r2.body).error.code).toBe('invalid_request')
  })

  it('records tx hash on signature submission', async () => {
    const m = await seedMerchant(t.prisma.db)
    const tx = await seedTransaction(t.prisma.db, m.id)
    const k = await seedApiKey(t.prisma.db, m.id)

    const create = await t.inject({
      method: 'POST',
      url: '/v1/refunds',
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: { transactionId: tx.id, amount: '10000000', reason: 'customer_request' },
    })
    const refundId = JSON.parse(create.body).refund.id

    const sig = await t.inject({
      method: 'POST',
      url: `/v1/refunds/${refundId}/signature`,
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: { refundTxHash: '0x' + 'b'.repeat(64) },
    })
    expect(sig.statusCode).toBe(201)
    const body = JSON.parse(sig.body)
    expect(body.status).toBe('submitted')
    expect(body.refundTxHash).toBe('0x' + 'b'.repeat(64))
  })
})
