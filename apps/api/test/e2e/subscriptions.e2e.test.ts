import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedApiKey, seedMerchant, seedSubscription } from '../helpers/fixtures.js'

describe('subscriptions e2e', () => {
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

  it('lists subscriptions scoped to the calling merchant', async () => {
    const m1 = await seedMerchant(t.prisma.db)
    const m2 = await seedMerchant(t.prisma.db)
    await seedSubscription(t.prisma.db, m1.id)
    await seedSubscription(t.prisma.db, m1.id)
    await seedSubscription(t.prisma.db, m2.id)
    const k = await seedApiKey(t.prisma.db, m1.id)

    const res = await t.inject({
      method: 'GET',
      url: '/v1/subscriptions',
      headers: { authorization: `Bearer ${k.secretKey}` },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.data).toHaveLength(2)
  })

  it('cancel transitions DB, enqueues on-chain cancel, fires webhook event', async () => {
    const m = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, m.id)
    const k = await seedApiKey(t.prisma.db, m.id)

    const res = await t.inject({
      method: 'POST',
      url: `/v1/subscriptions/${sub.id}/cancel`,
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: { reason: 'merchant initiated' },
    })
    expect(res.statusCode).toBe(201)

    const row = await t.prisma.db.subscription.findUnique({ where: { id: sub.id } })
    expect(row!.status).toBe('cancelled')
    expect(row!.cancellationReason).toBe('merchant initiated')

    const agentJobs = t.queue.jobsFor('strimz.agent.action')
    expect(agentJobs).toHaveLength(1)
    expect(agentJobs[0]!.name).toBe('subscription.cancel-onchain')

    // No webhook endpoint registered → no delivery jobs, but the event row exists.
    const events = await t.prisma.db.webhookEvent.findMany()
    expect(events).toHaveLength(1)
    expect(events[0]!.type).toBe('subscription_cancelled')
  })

  it('rejects double-cancel', async () => {
    const m = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, m.id, { status: 'cancelled' })
    const k = await seedApiKey(t.prisma.db, m.id)

    const res = await t.inject({
      method: 'POST',
      url: `/v1/subscriptions/${sub.id}/cancel`,
      headers: { authorization: `Bearer ${k.secretKey}` },
      payload: {},
    })
    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body).error.code).toBe('session_invalid_state')
  })

  it('returns 404 when accessing another merchant’s subscription', async () => {
    const m1 = await seedMerchant(t.prisma.db)
    const m2 = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, m2.id)
    const k = await seedApiKey(t.prisma.db, m1.id)

    const res = await t.inject({
      method: 'GET',
      url: `/v1/subscriptions/${sub.id}`,
      headers: { authorization: `Bearer ${k.secretKey}` },
    })
    expect(res.statusCode).toBe(404)
  })
})
