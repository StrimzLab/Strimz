import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedMerchant, seedSubscription } from '../helpers/fixtures.js'

describe('analytics e2e', () => {
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

  it('GET /v1/stats/mrr aggregates active subscriptions', async () => {
    const m = await seedMerchant(t.prisma.db)
    // 3 active monthly subs at 20 USDC each → MRR = 60 USDC.
    await seedSubscription(t.prisma.db, m.id, { amount: '20000000' })
    await seedSubscription(t.prisma.db, m.id, { amount: '20000000' })
    await seedSubscription(t.prisma.db, m.id, { amount: '20000000' })
    // One cancelled — should NOT count.
    await seedSubscription(t.prisma.db, m.id, { status: 'cancelled', amount: '999000000' })

    const res = await t.inject({
      method: 'GET',
      url: '/v1/stats/mrr',
      headers: { authorization: `Bearer ${m.privyAccessToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.activeSubscribers).toBe(3)
    expect(body.mrr).toBe('60000000')
  })

  it('GET /v1/stats/conversion / churn / forecast respond with the documented shape', async () => {
    const m = await seedMerchant(t.prisma.db)

    const conv = await t.inject({
      method: 'GET',
      url: '/v1/stats/conversion',
      headers: { authorization: `Bearer ${m.privyAccessToken}` },
    })
    expect(conv.statusCode).toBe(200)
    expect(JSON.parse(conv.body)).toMatchObject({ data: expect.any(Array) })

    const churn = await t.inject({
      method: 'GET',
      url: '/v1/stats/churn',
      headers: { authorization: `Bearer ${m.privyAccessToken}` },
    })
    expect(churn.statusCode).toBe(200)

    const forecast = await t.inject({
      method: 'GET',
      url: '/v1/stats/forecast',
      headers: { authorization: `Bearer ${m.privyAccessToken}` },
    })
    expect(forecast.statusCode).toBe(200)
    expect(JSON.parse(forecast.body).confidence).toBe('low') // <7 days of data
  })
})
