import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedMerchant, seedSubscription } from '../helpers/fixtures.js'
import { SubscriptionDueWorker } from '../../src/workers/subscription-due/subscription-due.worker.js'

const AMOUNT = 20_000_000n

// ADR-2026-11-13-capped-subscription-allowance: remind the payer before the cap runs out.
describe('subscription allowance reminder', () => {
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
    t.email.reset()
  })

  async function subscriber(email: string | null) {
    const merchant = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, merchant.id, {
      onchainSubscriptionId: 9,
      chargeLock: true,
    })
    if (email) {
      await t.prisma.db.customer.update({ where: { id: sub.customerId }, data: { email } })
    }
    return sub as { id: string; payerAddress: string; currentPeriodEndAt: Date }
  }

  const charge = (id: string) =>
    t.app.get(SubscriptionDueWorker).process({ data: { subscriptionId: id } } as never)
  const reminders = (to: string) =>
    t.email.sent.filter((m) => m.to === to && /renew/i.test(m.subject))

  it('emails the payer once when the allowance covers fewer than two more charges, and still charges', async () => {
    const sub = await subscriber('payer@buyer.test')
    t.chain.allowances.set(sub.payerAddress.toLowerCase(), AMOUNT * 2n)

    await charge(sub.id)
    await t.prisma.db.subscription.update({ where: { id: sub.id }, data: { chargeLock: true } })
    await charge(sub.id)

    expect(t.chain.callsFor('batchCharge')).toHaveLength(2)
    const mails = reminders('payer@buyer.test')
    expect(mails).toHaveLength(1)
    expect(mails[0]?.html).toContain(`/sub/renew/${sub.id}`)
    const row = await t.prisma.db.subscription.findUniqueOrThrow({ where: { id: sub.id } })
    expect(row.metadata).toMatchObject({
      allowanceLowAt: expect.any(String),
      allowanceReminderPeriodEnd: sub.currentPeriodEndAt.toISOString(),
    })
  })

  it('sends nothing while the allowance covers the next charges', async () => {
    const sub = await subscriber('payer@buyer.test')
    t.chain.allowances.set(sub.payerAddress.toLowerCase(), AMOUNT * 12n)

    await charge(sub.id)

    expect(reminders('payer@buyer.test')).toHaveLength(0)
    const row = await t.prisma.db.subscription.findUniqueOrThrow({ where: { id: sub.id } })
    expect((row.metadata as Record<string, unknown>).allowanceLowAt).toBeUndefined()
  })

  it('flags the subscription for the merchant even when the payer has no email', async () => {
    const sub = await subscriber(null)
    t.chain.allowances.set(sub.payerAddress.toLowerCase(), AMOUNT)

    await charge(sub.id)

    expect(t.email.sent.filter((m) => /renew/i.test(m.subject))).toHaveLength(0)
    const row = await t.prisma.db.subscription.findUniqueOrThrow({ where: { id: sub.id } })
    expect((row.metadata as Record<string, unknown>).allowanceLowAt).toEqual(expect.any(String))
  })

  it('clears the flag once the payer has renewed', async () => {
    const sub = await subscriber('payer@buyer.test')
    await t.prisma.db.subscription.update({
      where: { id: sub.id },
      data: { metadata: { allowanceLowAt: new Date().toISOString() } },
    })
    t.chain.allowances.set(sub.payerAddress.toLowerCase(), AMOUNT * 12n)

    await charge(sub.id)

    const row = await t.prisma.db.subscription.findUniqueOrThrow({ where: { id: sub.id } })
    expect((row.metadata as Record<string, unknown>).allowanceLowAt).toBeUndefined()
  })
})
