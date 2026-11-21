import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getTokenAddress } from '@strimz/shared-config'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedMerchant, seedTransaction } from '../helpers/fixtures.js'
import { FeeRefundService } from '../../src/crons/fee-refunds/fee-refund.service.js'
import { must } from '../helpers/must.js'

const UNIT = 1_000_000n
const USDC = getTokenAddress('testnet', 'USDC').toLowerCase()
const EURC = getTokenAddress('testnet', 'EURC').toLowerCase()

// ADR-2026-11-21-free-plan-fee-integrity: the fee is taken on chain, and Strimz
// refunds it on each business's first 1,000 of volume per currency.
describe('fee refunds e2e', () => {
  let t: TestApp
  let n = 0

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    t.refundChain.reset()
    t.refundChain.balances.set(USDC, 1_000n * UNIT)
    t.refundChain.balances.set(EURC, 1_000n * UNIT)
    t.email.reset()
  })

  const run = () => t.app.get(FeeRefundService).runNow()

  async function merchant(
    opts: { payout?: string; wallet?: string; tier?: 'free' | 'enterprise' } = {},
  ) {
    n += 1
    const m = await seedMerchant(t.prisma.db, {
      tier: opts.tier ?? 'free',
      onchainMerchantId: n,
      payoutAddress: opts.payout ?? `0x${(0xa000 + n).toString(16).padStart(40, '0')}`,
    })
    if (opts.wallet) {
      await t.prisma.db.merchant.update({
        where: { id: m.id },
        data: { walletAddress: opts.wallet },
      })
    }
    return m as { id: string; payoutAddress: string }
  }

  let minute = 0
  // A payment of `whole` units paying the 0.5% Starter fee.
  function pay(merchantId: string, whole: bigint, extra: Record<string, unknown> = {}) {
    minute += 1
    const amount = whole * UNIT
    return seedTransaction(t.prisma.db, merchantId, {
      amount: String(amount),
      feeAmount: String((amount * 50n) / 10_000n),
      blockTimestamp: new Date(Date.UTC(2026, 10, 1, 0, minute)),
      ...extra,
    })
  }

  const refunded = (merchantId: string) =>
    t.prisma.db.feeRefund.findMany({ where: { merchantId }, orderBy: { createdAt: 'asc' } })

  it('refunds the fees on the first 1,000, with the payment that crosses refunded pro rata', async () => {
    const m = await merchant()
    await pay(m.id, 600n)
    await pay(m.id, 300n)
    await pay(m.id, 200n)
    await pay(m.id, 50n)

    await run()

    const total = (await refunded(m.id)).reduce((sum, r) => sum + BigInt(r.amount), 0n)
    expect(total).toBe(5n * UNIT)
    expect(t.refundChain.signed).toHaveLength(1)
    const transfer = must(t.refundChain.signed[0])
    expect(transfer.amount).toBe(5n * UNIT)
    expect(transfer.to.toLowerCase()).toBe(m.payoutAddress.toLowerCase())
    expect(transfer.token.toLowerCase()).toBe(USDC)
  })

  it('gives each currency its own allowance', async () => {
    const m = await merchant()
    await pay(m.id, 1_000n)
    await pay(m.id, 1_000n, { currency: 'EURC' })

    await run()

    expect(t.refundChain.signed.map((s) => [s.token.toLowerCase(), s.amount]).sort()).toEqual(
      [
        [EURC, 5n * UNIT],
        [USDC, 5n * UNIT],
      ].sort(),
    )
  })

  it('shares one allowance across accounts linked through each other', async () => {
    const shared = '0x00000000000000000000000000000000000c0ffe'
    const wallet = '0x00000000000000000000000000000000000d00d1'
    const a = await merchant({ payout: shared })
    const b = await merchant({ payout: shared, wallet })
    const c = await merchant({ wallet })
    await pay(a.id, 400n)
    await pay(b.id, 400n)
    await pay(c.id, 400n)

    await run()

    const total = [
      ...(await refunded(a.id)),
      ...(await refunded(b.id)),
      ...(await refunded(c.id)),
    ].reduce((sum, r) => sum + BigInt(r.amount), 0n)
    expect(total).toBe(5n * UNIT)
    expect((await refunded(c.id)).map((r) => r.amount)).toEqual([String(1n * UNIT)])
  })

  it('does not let an unregistered account join two businesses together', async () => {
    const victimPayout = '0x00000000000000000000000000000000000beef1'
    const attackerWallet = '0x00000000000000000000000000000000000bad01'
    const victim = await merchant({ payout: victimPayout })
    const attacker = await merchant({ wallet: attackerWallet })
    const bridge = await seedMerchant(t.prisma.db, { payoutAddress: victimPayout })
    await t.prisma.db.merchant.update({
      where: { id: bridge.id },
      data: { walletAddress: attackerWallet },
    })
    await pay(attacker.id, 1_000n)
    await pay(victim.id, 200n)

    await run()

    expect((await refunded(victim.id)).map((r) => r.amount)).toEqual([String(1n * UNIT)])
  })

  it('never refunds a payment twice, however often it runs', async () => {
    const m = await merchant()
    await pay(m.id, 200n)

    await run()
    await run()
    t.refundChain.receipts.set(must(t.refundChain.signed[0]).txHash, 'success')
    await run()
    await run()

    expect(t.refundChain.signed).toHaveLength(1)
    expect(await refunded(m.id)).toHaveLength(1)
    expect(must((await refunded(m.id))[0]).status).toBe('refunded')
  })

  it('rebroadcasts the same signed transfer after a failed broadcast, never signing again', async () => {
    const m = await merchant()
    await pay(m.id, 200n)
    t.refundChain.failNextBroadcast = true

    await run()
    expect(t.refundChain.signed).toHaveLength(1)
    expect(t.refundChain.broadcasts).toHaveLength(0)
    expect(t.email.sent.filter((e) => e.subject.includes('could not be sent'))).toHaveLength(1)

    await run()
    expect(t.refundChain.signed).toHaveLength(1)
    expect(t.refundChain.broadcasts).toHaveLength(1)
    expect(await refunded(m.id)).toHaveLength(1)
  })

  it('pays again with a new transfer only after the chain shows the first one reverted', async () => {
    const m = await merchant()
    await pay(m.id, 200n)
    await run()
    const first = must(t.refundChain.signed[0])
    t.refundChain.receipts.set(first.txHash, 'reverted')

    await run()

    expect(t.refundChain.signed).toHaveLength(2)
    expect(must(t.refundChain.signed[1]).nonce).toBeGreaterThan(first.nonce)
    const transfers = await t.prisma.db.feeRefundTransfer.findMany({ orderBy: { nonce: 'asc' } })
    expect(transfers.map((x) => x.status)).toEqual(['failed', 'signed'])
  })

  it('leaves refunds pending and tells ops when the refund wallet is short', async () => {
    const m = await merchant()
    await pay(m.id, 200n)
    t.refundChain.balances.set(USDC, 0n)

    await run()

    expect(t.refundChain.signed).toHaveLength(0)
    expect(must((await refunded(m.id))[0]).status).toBe('pending')
    expect(t.email.sent.filter((e) => e.subject.includes('Refund wallet'))).toHaveLength(1)
  })

  it('skips payments a customer was refunded, refund transfers, other modes, and Enterprise', async () => {
    const m = await merchant()
    const refundedPayment = await pay(m.id, 100n)
    await t.prisma.db.refund.create({
      data: {
        merchantId: m.id,
        transactionId: refundedPayment.id,
        amount: String(100n * UNIT),
        currency: 'USDC',
        reason: 'customer_request',
        payerAddress: '0x000000000000000000000000000000000000cafe',
        initiatedById: 'admin_e2e',
        status: 'completed',
      },
    })
    await pay(m.id, 100n, { kind: 'refund' })
    await pay(m.id, 100n, { mode: 'live' })
    const ent = await merchant({ tier: 'enterprise' })
    await pay(ent.id, 100n)

    await run()

    expect(await t.prisma.db.feeRefund.count()).toBe(0)
  })

  it('does nothing without a refund wallet', async () => {
    const m = await merchant()
    await pay(m.id, 200n)
    t.refundChain.address = null

    expect(await run()).toMatchObject({ disabled: true })
    expect(await t.prisma.db.feeRefund.count()).toBe(0)
  })
})
