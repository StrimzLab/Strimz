import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { MerchantTier } from '@strimz/db'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedMerchant, seedTransaction } from '../helpers/fixtures.js'
import { PlanUpgradeService } from '../../src/crons/plan-upgrade/plan-upgrade.service.js'
import { must } from '../helpers/must.js'

const UNIT = 1_000_000n

describe('plan upgrade by all-time volume e2e', () => {
  let t: TestApp
  let onchainId = 1

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    t.chain.reset()
    t.email.reset()
  })

  const run = () => t.app.get(PlanUpgradeService).upgradeNow()

  async function merchantWith(
    tier: MerchantTier,
    volumes: { USDC?: bigint; EURC?: bigint } = {},
    registered = true,
  ) {
    const id = onchainId++
    const m = await seedMerchant(t.prisma.db, {
      tier,
      onchainMerchantId: registered ? id : null,
    })
    for (const currency of ['USDC', 'EURC'] as const) {
      const whole = volumes[currency]
      if (whole !== undefined) {
        await seedTransaction(t.prisma.db, m.id, { currency, amount: String(whole * UNIT) })
      }
    }
    return { id: m.id as string, email: m.email as string, onchainId: BigInt(id) }
  }

  const tierOf = async (id: string) =>
    (await t.prisma.db.merchant.findUniqueOrThrow({ where: { id }, select: { tier: true } })).tier

  it('moves a Free merchant to Starter at 1,000 USDC: on-chain first, then the database, then an email', async () => {
    const m = await merchantWith('free', { USDC: 1_000n })

    const result = await run()

    expect(result).toMatchObject({ upgraded: 1, failed: 0 })
    expect(t.chain.callsFor('setMerchantFeeBps').map((c) => c.args)).toEqual([[m.onchainId, 50]])
    expect(await tierOf(m.id)).toBe('starter')
    expect(t.email.sent).toHaveLength(1)
    const mail = must(t.email.sent[0])
    expect(mail.to).toBe(m.email)
    expect(mail.subject).toContain('Starter')
    expect(mail.html).toContain('0.5%')
    const audit = await t.prisma.db.auditLog.findFirstOrThrow({
      where: { merchantId: m.id, action: 'merchant.plan_upgraded' },
    })
    expect(audit.metadata).toMatchObject({
      previous: 'free',
      next: 'starter',
      feeBps: 50,
      volumes: { USDC: String(1_000n * UNIT), EURC: '0' },
    })
  })

  it('moves a Free merchant to Starter at 1,000 EURC', async () => {
    const m = await merchantWith('free', { EURC: 1_000n })
    await run()
    expect(await tierOf(m.id)).toBe('starter')
  })

  it('does not add 600 USDC and 600 EURC together', async () => {
    const m = await merchantWith('free', { USDC: 600n, EURC: 600n })

    const result = await run()

    expect(result.upgraded).toBe(0)
    expect(t.chain.callsFor('setMerchantFeeBps')).toHaveLength(0)
    expect(await tierOf(m.id)).toBe('free')
    expect(t.email.sent).toHaveLength(0)
  })

  it('moves a Free merchant straight to Growth at 50,000', async () => {
    const m = await merchantWith('free', { EURC: 50_000n })
    await run()
    expect(t.chain.callsFor('setMerchantFeeBps').map((c) => c.args)).toEqual([[m.onchainId, 40]])
    expect(await tierOf(m.id)).toBe('growth')
    expect(must(t.email.sent[0]).html).toContain('0.4%')
  })

  it('moves a Starter merchant to Growth at 50,000 USDC', async () => {
    const m = await merchantWith('starter', { USDC: 50_000n })
    t.chain.registryFees.set(m.onchainId, 50)
    await run()
    expect(await tierOf(m.id)).toBe('growth')
  })

  it('never moves a merchant down, and leaves Growth and Enterprise alone', async () => {
    const starter = await merchantWith('starter')
    const growth = await merchantWith('growth', { USDC: 5_000_000n })
    const enterprise = await merchantWith('enterprise', { USDC: 5_000_000n })

    await run()

    expect(t.chain.callsFor('setMerchantFeeBps')).toHaveLength(0)
    expect(await tierOf(starter.id)).toBe('starter')
    expect(await tierOf(growth.id)).toBe('growth')
    expect(await tierOf(enterprise.id)).toBe('enterprise')
  })

  it('counts only confirmed payments in the deployment mode', async () => {
    const m = await merchantWith('free')
    const big = String(5_000n * UNIT)
    await seedTransaction(t.prisma.db, m.id, { amount: big, mode: 'live' })
    await seedTransaction(t.prisma.db, m.id, { amount: big, status: 'pending' })
    await seedTransaction(t.prisma.db, m.id, { amount: big, status: 'failed' })
    await seedTransaction(t.prisma.db, m.id, { amount: big, kind: 'refund' })

    await run()

    expect(await tierOf(m.id)).toBe('free')
  })

  it('counts every kind of payment toward the threshold', async () => {
    const m = await merchantWith('free')
    for (const kind of [
      'one_shot',
      'subscription_charge',
      'invoice_payment',
      'storefront_purchase',
    ] as const) {
      await seedTransaction(t.prisma.db, m.id, { kind, amount: String(250n * UNIT) })
    }
    await run()
    expect(await tierOf(m.id)).toBe('starter')
  })

  it('skips a merchant that is not registered on-chain', async () => {
    const m = await merchantWith('free', { USDC: 1_000n }, false)
    await run()
    expect(t.chain.callsFor('setMerchantFeeBps')).toHaveLength(0)
    expect(await tierOf(m.id)).toBe('free')
  })

  it('keeps the plan when the fee change fails, and still upgrades the others', async () => {
    const failing = await merchantWith('free', { USDC: 1_000n })
    const ok = await merchantWith('free', { USDC: 1_000n })
    t.chain.feeWriteFailures.add(failing.onchainId)

    const result = await run()

    expect(result).toMatchObject({ upgraded: 1, failed: 1 })
    expect(await tierOf(failing.id)).toBe('free')
    expect(await tierOf(ok.id)).toBe('starter')
    expect(t.email.sent.map((e) => e.to)).toEqual([ok.email])

    t.chain.feeWriteFailures.clear()
    await run()
    expect(await tierOf(failing.id)).toBe('starter')
  })

  it('does not send the fee again when the registry already charges it', async () => {
    const m = await merchantWith('free', { USDC: 1_000n })
    t.chain.registryFees.set(m.onchainId, 50)

    await run()

    expect(t.chain.callsFor('setMerchantFeeBps')).toHaveLength(0)
    expect(await tierOf(m.id)).toBe('starter')
    expect(t.email.sent).toHaveLength(1)
  })

  it('keeps the upgrade and reports it when the email fails', async () => {
    const m = await merchantWith('free', { USDC: 1_000n })
    t.email.failNext = true

    const result = await run()

    expect(result).toMatchObject({ upgraded: 1, failed: 0, emailFailed: 1 })
    expect(await tierOf(m.id)).toBe('starter')
  })

  it('upgrades once when two runs overlap', async () => {
    const m = await merchantWith('free', { USDC: 1_000n })

    await Promise.all([run(), run()])

    expect(t.chain.callsFor('setMerchantFeeBps')).toHaveLength(1)
    expect(await tierOf(m.id)).toBe('starter')
    expect(t.email.sent).toHaveLength(1)
  })
})
