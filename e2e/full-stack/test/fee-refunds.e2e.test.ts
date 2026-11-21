import { afterAll, describe, expect, inject, it } from 'vitest'

import { payViaCheckout } from './flows.js'
import { actors, db, eventually, merchant, usdcBalance } from './support.js'

const AMOUNT = 4_000_000n // 4 USDC
const schedulerUrl = inject('scheduler').readyUrl.replace(/\/readyz$/u, '')

async function runRefunds(): Promise<void> {
  const res = await fetch(`${schedulerUrl}/admin/run/fee-refunds`, { method: 'POST' })
  if (!res.ok) throw new Error(`fee-refund run failed: ${res.status} ${await res.text()}`)
}

// ADR-2026-11-21-free-plan-fee-integrity: the fee is taken on chain, and the first
// 1,000 per currency is paid back from the refund wallet.
describe('free-allowance fee refunds', () => {
  afterAll(async () => {
    await db().$disconnect()
  })

  it('takes the fee on chain, then pays it back to the payout wallet', async () => {
    const { sessionId } = await payViaCheckout(AMOUNT)
    const payment = await eventually(
      'payment confirmed',
      () => db().transaction.findFirst({ where: { sessionId, status: 'confirmed' } }),
      (tx) => tx != null,
      90_000,
    )
    if (!payment) throw new Error('payment was not indexed')
    expect(BigInt(payment.feeAmount)).toBe((AMOUNT * BigInt(merchant.feeBps)) / 10_000n)

    const payoutBefore = await usdcBalance(actors.payout.address)
    const walletBefore = await usdcBalance(actors.refund.address)

    await runRefunds()
    const refund = await db().feeRefund.findUnique({ where: { transactionId: payment.id } })
    expect(refund?.amount).toBe(payment.feeAmount)

    // Every seeded merchant pays out to the same wallet, so they are one business.
    const toPayout = { toAddress: { equals: actors.payout.address, mode: 'insensitive' as const } }
    const transfers = await eventually(
      'refund transfers confirmed',
      async () => {
        await runRefunds()
        return db().feeRefundTransfer.findMany({ where: toPayout })
      },
      (rows) => rows.length > 0 && rows.every((x) => x.status === 'confirmed'),
      90_000,
    )
    const total = transfers.reduce((sum, x) => sum + BigInt(x.amount), 0n)

    expect((await usdcBalance(actors.payout.address)) - payoutBefore).toBe(total)
    expect(walletBefore - (await usdcBalance(actors.refund.address))).toBeGreaterThanOrEqual(total)
    expect(
      (await db().feeRefund.findUnique({ where: { transactionId: payment.id } }))?.status,
    ).toBe('refunded')
  })
})
