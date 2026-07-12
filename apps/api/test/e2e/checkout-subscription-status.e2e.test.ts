import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedApiKey, seedMerchant, seedSubscription } from '../helpers/fixtures.js'

/**
 * Duplicate-enrolment guard: the public checkout status endpoint and the
 * relay-side 409, both keyed on (planId, payer).
 */
describe('checkout subscription-status e2e', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    t.queue.reset()
  })

  it('404s for an unknown plan', async () => {
    const res = await t.inject({
      method: 'GET',
      url: `/v1/checkout/plans/plan_missing/subscription?payer=0x${'a'.repeat(40)}`,
    })
    expect(res.statusCode).toBe(404)
  })

  it('active:false when the wallet has no subscription to the plan', async () => {
    const m = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, m.id) // payer 0xccc…
    const res = await t.inject({
      method: 'GET',
      url: `/v1/checkout/plans/${sub.planId}/subscription?payer=0x${'d'.repeat(40)}`,
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ active: false, subscriptionId: null })
  })

  it('active:true (+ id) when the wallet already subscribes to the plan', async () => {
    const m = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, m.id) // active, payer 0xccc…
    const res = await t.inject({
      method: 'GET',
      url: `/v1/checkout/plans/${sub.planId}/subscription?payer=${sub.payerAddress}`,
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ active: true, subscriptionId: sub.id })
  })

  it('matches the payer case-insensitively', async () => {
    const m = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, m.id)
    const upper = `0x${sub.payerAddress.slice(2).toUpperCase()}`
    const res = await t.inject({
      method: 'GET',
      url: `/v1/checkout/plans/${sub.planId}/subscription?payer=${upper}`,
    })
    expect(JSON.parse(res.body)).toEqual({ active: true, subscriptionId: sub.id })
  })

  it('does not match across plans (a sub to plan A never blocks plan B)', async () => {
    const m = await seedMerchant(t.prisma.db)
    const subA = await seedSubscription(t.prisma.db, m.id)
    const subB = await seedSubscription(t.prisma.db, m.id, {
      payerAddress: `0x${'e'.repeat(40)}`,
    })
    const res = await t.inject({
      method: 'GET',
      url: `/v1/checkout/plans/${subB.planId}/subscription?payer=${subA.payerAddress}`,
    })
    expect(JSON.parse(res.body)).toEqual({ active: false, subscriptionId: null })
  })

  it('a cancelled subscription does not count as active', async () => {
    const m = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, m.id, { status: 'cancelled' })
    const res = await t.inject({
      method: 'GET',
      url: `/v1/checkout/plans/${sub.planId}/subscription?payer=${sub.payerAddress}`,
    })
    expect(JSON.parse(res.body)).toEqual({ active: false, subscriptionId: null })
  })

  it('relay enrolment 409s when the wallet already subscribes to the plan', async () => {
    const m = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, m.id) // active
    const k = await seedApiKey(t.prisma.db, m.id, { scopes: ['relay_write'] })

    const res = await t.inject({
      method: 'POST',
      url: '/v1/relay/subscriptions',
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: {
        idempotencyKey: `${sub.planId}:${sub.payerAddress}`,
        merchantId: '1',
        token: `0x${'a'.repeat(40)}`,
        amount: '5000000',
        interval: 2_592_000,
        startAt: '0',
        endAt: '0',
        permitData: { owner: sub.payerAddress, value: '5000000', deadline: '9999999999' },
        permitSignature: { v: 27, r: `0x${'1'.repeat(64)}`, s: `0x${'2'.repeat(64)}` },
        intentSignature: { v: 27, r: `0x${'3'.repeat(64)}`, s: `0x${'4'.repeat(64)}` },
        subscriptionInternalId: sub.planId,
      },
    })
    expect(res.statusCode).toBe(409)
    expect(JSON.parse(res.body).error.code).toBe('subscription_exists')
    // Guard runs before enqueue — no relay job should have been queued.
    expect(t.queue.jobsFor('strimz.relay.submission')).toHaveLength(0)
  })
})
