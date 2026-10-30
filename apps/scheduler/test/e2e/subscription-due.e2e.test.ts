import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedMerchant, seedSubscription } from '../helpers/fixtures.js'
import {
  deriveChargeAttemptId,
  MAX_ATTEMPTS_PER_PERIOD,
  SubscriptionDueWorker,
} from '../../src/workers/subscription-due/subscription-due.worker.js'
import { must } from '../helpers/must.js'

describe('subscription-due worker e2e', () => {
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

  it('signs batchCharge with derived attempt id, releases lock, returns tx hash', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, merchant.id, {
      onchainSubscriptionId: 7,
      chargeLock: true,
    })

    const worker = t.app.get(SubscriptionDueWorker)
    const result = await worker.process({ data: { subscriptionId: sub.id } } as never)
    expect(result.txHash).toMatch(/^0x/)
    expect(result.chargeAttemptId).toBe(deriveChargeAttemptId(7, sub.currentPeriodEndAt, 0))

    const calls = t.chain.callsFor('batchCharge')
    expect(calls).toHaveLength(1)
    expect((must(calls[0]).args[0] as bigint[])[0]).toBe(7n)
    expect((must(calls[0]).args[1] as string[])[0]).toBe(result.chargeAttemptId)

    const updated = await t.prisma.db.subscription.findUniqueOrThrow({ where: { id: sub.id } })
    expect(updated.chargeLock).toBe(false)
  })

  it('charges with the next attempt id when the first one is already burned', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, merchant.id, {
      onchainSubscriptionId: 7,
      chargeLock: true,
    })
    const first = deriveChargeAttemptId(7, sub.currentPeriodEndAt, 0)
    const second = deriveChargeAttemptId(7, sub.currentPeriodEndAt, 1)
    t.chain.attemptUsedAnswers.set(first, true)

    const worker = t.app.get(SubscriptionDueWorker)
    const result = await worker.process({ data: { subscriptionId: sub.id } } as never)

    expect(second).not.toBe(first)
    expect(result.chargeAttemptId).toBe(second)
    const calls = t.chain.callsFor('batchCharge')
    expect(calls).toHaveLength(1)
    expect((must(calls[0]).args[1] as string[])[0]).toBe(second)
  })

  it('skips broadcast when the contract says the charge is not due', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, merchant.id, {
      onchainSubscriptionId: 7,
      chargeLock: true,
    })
    t.chain.chargeDueAnswers.set(7n, false)

    const worker = t.app.get(SubscriptionDueWorker)
    const result = await worker.process({ data: { subscriptionId: sub.id } } as never)

    expect(result).toEqual({ txHash: '0xnotdue', chargeAttemptId: '0x0' })
    expect(t.chain.callsFor('batchCharge')).toHaveLength(0)
    const updated = await t.prisma.db.subscription.findUniqueOrThrow({ where: { id: sub.id } })
    expect(updated.chargeLock).toBe(false)
  })

  it.each(['cancelled', 'lapsed'] as const)(
    'skips broadcast for a %s subscription',
    async (status) => {
      const merchant = await seedMerchant(t.prisma.db)
      const sub = await seedSubscription(t.prisma.db, merchant.id, {
        onchainSubscriptionId: 7,
        chargeLock: true,
        status,
      })

      const worker = t.app.get(SubscriptionDueWorker)
      const result = await worker.process({ data: { subscriptionId: sub.id } } as never)

      expect(result).toEqual({ txHash: '0x0', chargeAttemptId: '0x0' })
      expect(t.chain.callsFor('batchCharge')).toHaveLength(0)
      const updated = await t.prisma.db.subscription.findUniqueOrThrow({ where: { id: sub.id } })
      expect(updated.chargeLock).toBe(false)
    },
  )

  it('skips broadcast when every attempt id for the period is already used', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, merchant.id, {
      onchainSubscriptionId: 7,
      chargeLock: true,
    })

    // Pre-seed the stub: any attempt id query returns true.
    t.chain.attemptUsedDefault = true
    const worker = t.app.get(SubscriptionDueWorker)
    const result = await worker.process({ data: { subscriptionId: sub.id } } as never)
    expect(result).toEqual({ txHash: '0xexhausted', chargeAttemptId: '0x0' })
    expect(t.chain.callsFor('batchCharge')).toHaveLength(0)

    const updated = await t.prisma.db.subscription.findUniqueOrThrow({ where: { id: sub.id } })
    expect(updated.chargeLock).toBe(false)
  })

  it('releases lock and rethrows when broadcast fails', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, merchant.id, {
      onchainSubscriptionId: 7,
      chargeLock: true,
    })

    t.chain.failNext = true
    const worker = t.app.get(SubscriptionDueWorker)
    await expect(worker.process({ data: { subscriptionId: sub.id } } as never)).rejects.toThrow(
      /failNext/,
    )

    const updated = await t.prisma.db.subscription.findUniqueOrThrow({ where: { id: sub.id } })
    expect(updated.chargeLock).toBe(false)
  })

  it('skips when subscription has no on-chain id (indexer not caught up)', async () => {
    const merchant = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, merchant.id, {
      onchainSubscriptionId: null,
      chargeLock: true,
    })

    const worker = t.app.get(SubscriptionDueWorker)
    await expect(worker.process({ data: { subscriptionId: sub.id } } as never)).rejects.toThrow(
      /onchainSubscriptionId/,
    )
    const updated = await t.prisma.db.subscription.findUniqueOrThrow({ where: { id: sub.id } })
    expect(updated.chargeLock).toBe(false)
  })

  describe('retries against the contract model', () => {
    async function dueSub() {
      const merchant = await seedMerchant(t.prisma.db)
      return seedSubscription(t.prisma.db, merchant.id, { onchainSubscriptionId: 7 })
    }
    const run = (subscriptionId: string) =>
      t.app.get(SubscriptionDueWorker).process({ data: { subscriptionId } } as never)
    const chargedIds = () =>
      t.chain.callsFor('batchCharge').map((c) => must((c.args[1] as string[])[0]))

    it('retries with the next attempt id after a TransferFailed and charges the period once', async () => {
      const sub = await dueSub()
      t.chain.chargeOutcomes.push('TransferFailed', 'Charged')

      await run(sub.id)
      await run(sub.id)
      const third = await run(sub.id)

      expect(chargedIds()).toEqual([
        deriveChargeAttemptId(7, sub.currentPeriodEndAt, 0),
        deriveChargeAttemptId(7, sub.currentPeriodEndAt, 1),
      ])
      expect(third).toEqual({ txHash: '0xnotdue', chargeAttemptId: '0x0' })
    })

    it('stops after the eighth burned attempt id in a period', async () => {
      const sub = await dueSub()
      t.chain.chargeOutcomes.push(
        ...Array<'TransferFailed'>(MAX_ATTEMPTS_PER_PERIOD).fill('TransferFailed'),
      )

      for (let i = 0; i < MAX_ATTEMPTS_PER_PERIOD; i++) await run(sub.id)
      const exhausted = await run(sub.id)

      expect(MAX_ATTEMPTS_PER_PERIOD).toBe(8)
      expect(chargedIds()).toEqual(
        Array.from({ length: 8 }, (_, i) => deriveChargeAttemptId(7, sub.currentPeriodEndAt, i)),
      )
      expect(exhausted).toEqual({ txHash: '0xexhausted', chargeAttemptId: '0x0' })
      expect(t.chain.callsFor('batchCharge')).toHaveLength(8)
      const updated = await t.prisma.db.subscription.findUniqueOrThrow({ where: { id: sub.id } })
      expect(updated.chargeLock).toBe(false)
    })

    it('reuses the same attempt id after a balance skip, which burns nothing', async () => {
      const sub = await dueSub()
      t.chain.chargeOutcomes.push('InsufficientFunds', 'Charged')

      await run(sub.id)
      await run(sub.id)

      const first = deriveChargeAttemptId(7, sub.currentPeriodEndAt, 0)
      expect(chargedIds()).toEqual([first, first])
      expect(await run(sub.id)).toEqual({ txHash: '0xnotdue', chargeAttemptId: '0x0' })
    })
  })
})
