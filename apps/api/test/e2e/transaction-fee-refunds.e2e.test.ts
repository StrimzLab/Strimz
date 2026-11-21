import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedApiKey, seedMerchant, seedTransaction } from '../helpers/fixtures.js'

const HASH = `0x${'ab'.repeat(32)}`

// ADR-2026-11-21-free-plan-fee-integrity: merchants see the free-allowance refund.
describe('transaction fee refunds', () => {
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

  it('shows the fee refund on a refunded payment, and null on one outside the allowance', async () => {
    const m = await seedMerchant(t.prisma.db)
    const k = await seedApiKey(t.prisma.db, m.id, { scopes: ['transactions_read'] })
    const inside = await seedTransaction(t.prisma.db, m.id)
    const outside = await seedTransaction(t.prisma.db, m.id)
    const transfer = await t.prisma.db.feeRefundTransfer.create({
      data: {
        merchantId: m.id,
        currency: 'USDC',
        amount: '5000',
        toAddress: '0x000000000000000000000000000000000000beef',
        fromAddress: '0x00000000000000000000000000000000000000e5',
        nonce: 0,
        txHash: HASH,
        signedTx: '0x01',
        status: 'confirmed',
        mode: 'test',
      },
    })
    await t.prisma.db.feeRefund.create({
      data: {
        merchantId: m.id,
        transactionId: inside.id,
        currency: 'USDC',
        amount: '5000',
        mode: 'test',
        status: 'refunded',
        transferId: transfer.id,
      },
    })

    const one = await t.inject({
      method: 'GET',
      url: `/v1/transactions/${inside.id}`,
      headers: { authorization: `Bearer ${k.secretKey}` },
    })
    expect(one.statusCode).toBe(200)
    expect(JSON.parse(one.body).feeRefund).toEqual({
      amount: '5000',
      status: 'refunded',
      txHash: HASH,
    })

    const list = await t.inject({
      method: 'GET',
      url: '/v1/transactions',
      headers: { authorization: `Bearer ${k.secretKey}` },
    })
    const rows = JSON.parse(list.body).data as Array<{ id: string; feeRefund: unknown }>
    expect(rows.find((r) => r.id === outside.id)?.feeRefund).toBeNull()
    expect(rows.find((r) => r.id === inside.id)?.feeRefund).toMatchObject({ status: 'refunded' })
  })
})
