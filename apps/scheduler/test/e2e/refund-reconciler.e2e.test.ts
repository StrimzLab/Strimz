import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { RefundStatus } from '@strimz/db'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedMerchant, seedTransaction } from '../helpers/fixtures.js'
import { RefundReconcilerService } from '../../src/crons/refund-reconciler/refund-reconciler.service.js'
import type { TransferReceipt } from '../../src/infra/chain/chain.service.js'

const USDC = '0x3600000000000000000000000000000000000000'
const EURC = '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a'
const PAYER = '0x000000000000000000000000000000000000cafe'
const BLOCK_TIME = new Date('2026-11-13T10:00:00.000Z')

let hashSeq = 0
const nextHash = () => `0x${(++hashSeq).toString(16).padStart(64, '0')}` as `0x${string}`

describe('refund reconciler e2e', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    t.chain.reset()
  })

  const run = () => t.app.get(RefundReconcilerService).reconcileNow()

  async function refund(status: RefundStatus = 'submitted', amount = '500000') {
    const m = await seedMerchant(t.prisma.db)
    const tx = await seedTransaction(t.prisma.db, m.id)
    const hash = nextHash()
    const row = await t.prisma.db.refund.create({
      data: {
        merchantId: m.id,
        transactionId: tx.id,
        amount,
        currency: 'USDC',
        reason: 'customer_request',
        status,
        payerAddress: PAYER,
        refundTxHash: hash,
        initiatedById: m.id,
        completedAt: status === 'completed' ? BLOCK_TIME : null,
      },
    })
    return { id: row.id, hash }
  }

  const receipt = (over: Partial<TransferReceipt> = {}): TransferReceipt => ({
    status: 'success',
    blockTime: BLOCK_TIME,
    transfers: [
      { token: '0x0000000000000000000000000000000000000000', to: PAYER, value: 1n },
      { token: USDC, to: '0x000000000000000000000000000000000000CAFE', value: 500000n },
    ],
    ...over,
  })

  const completedEvents = () =>
    t.prisma.db.webhookEvent.findMany({ where: { type: 'refund_completed' } })

  it('completes a refund the indexer missed and queues one refund.completed', async () => {
    const r = await refund()
    t.chain.receipts.set(r.hash, receipt())

    expect(await run()).toEqual({ checked: 1, completed: 1, failed: 0, pending: 0, errors: 0 })

    const row = await t.prisma.db.refund.findUniqueOrThrow({ where: { id: r.id } })
    expect(row.status).toBe('completed')
    expect(row.completedAt).toEqual(BLOCK_TIME)
    const events = await completedEvents()
    expect(events).toHaveLength(1)
    expect(events[0]?.payload).toEqual({ ref: { kind: 'refund.completed', refundId: r.id } })

    expect(await run()).toEqual({ checked: 0, completed: 0, failed: 0, pending: 0, errors: 0 })
    expect(await completedEvents()).toHaveLength(1)
  })

  it('fails a reverted refund', async () => {
    const r = await refund()
    t.chain.receipts.set(r.hash, receipt({ status: 'reverted', transfers: [] }))

    expect(await run()).toMatchObject({ failed: 1 })
    const row = await t.prisma.db.refund.findUniqueOrThrow({ where: { id: r.id } })
    expect(row.status).toBe('failed')
    expect(row.failureReason).toBe('transaction reverted')
    expect(await completedEvents()).toHaveLength(0)
  })

  it.each([
    ['wrong token', { token: EURC, to: PAYER, value: 500000n }],
    [
      'wrong recipient',
      { token: USDC, to: '0x000000000000000000000000000000000000dead', value: 500000n },
    ],
    ['wrong amount', { token: USDC, to: PAYER, value: 499999n }],
  ] as const)('fails a refund whose transfer has the %s', async (_, transfer) => {
    const r = await refund()
    t.chain.receipts.set(r.hash, receipt({ transfers: [{ ...transfer }] }))

    expect(await run()).toMatchObject({ failed: 1 })
    const row = await t.prisma.db.refund.findUniqueOrThrow({ where: { id: r.id } })
    expect(row.status).toBe('failed')
    expect(row.failureReason).toBe('transfer did not match token, recipient or amount')
  })

  it('leaves a refund with no receipt yet as submitted', async () => {
    const r = await refund()

    expect(await run()).toMatchObject({ checked: 1, pending: 1 })
    const row = await t.prisma.db.refund.findUniqueOrThrow({ where: { id: r.id } })
    expect(row.status).toBe('submitted')
  })

  it('does not touch refunds that are not submitted', async () => {
    const done = await refund('completed')
    const waiting = await refund('awaiting_signature')
    t.chain.receipts.set(done.hash, receipt({ status: 'reverted', transfers: [] }))
    t.chain.receipts.set(waiting.hash, receipt())

    expect(await run()).toMatchObject({ checked: 0 })
    expect((await t.prisma.db.refund.findUniqueOrThrow({ where: { id: done.id } })).status).toBe(
      'completed',
    )
    expect((await t.prisma.db.refund.findUniqueOrThrow({ where: { id: waiting.id } })).status).toBe(
      'awaiting_signature',
    )
  })

  it('keeps going when one receipt lookup fails', async () => {
    const broken = await refund()
    const fine = await refund()
    t.chain.receipts.set(broken.hash, new Error('rpc down'))
    t.chain.receipts.set(fine.hash, receipt())

    expect(await run()).toMatchObject({ checked: 2, completed: 1, errors: 1 })
    expect((await t.prisma.db.refund.findUniqueOrThrow({ where: { id: broken.id } })).status).toBe(
      'submitted',
    )
  })
})
