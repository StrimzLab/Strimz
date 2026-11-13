import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedMerchant, seedSubscription } from '../helpers/fixtures.js'

// ADR-2026-11-13-capped-subscription-allowance: the merchant sees it in the tray too.
describe('allowance-low notifications', () => {
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

  it('lists a subscription whose payer approval is running low', async () => {
    const m = await seedMerchant(t.prisma.db)
    const low = await seedSubscription(t.prisma.db, m.id)
    await seedSubscription(t.prisma.db, m.id)
    const flaggedAt = new Date(Date.now() - 60_000).toISOString()
    await t.prisma.db.subscription.update({
      where: { id: low.id },
      data: { metadata: { allowanceLowAt: flaggedAt } },
    })

    const res = await t.inject({
      method: 'GET',
      url: '/v1/notifications',
      headers: { authorization: `Bearer ${m.privyAccessToken}` },
    })

    expect(res.statusCode).toBe(200)
    const items = (
      JSON.parse(res.body) as {
        data: { id: string; kind: string; href: string; createdAt: string }[]
      }
    ).data
    const lowItems = items.filter((n) => n.kind === 'allowance_low')
    expect(lowItems).toEqual([
      expect.objectContaining({
        id: `allowance_low:${low.id}`,
        href: `/app/subscriptions/${low.id}`,
        createdAt: flaggedAt,
      }),
    ])
  })
})
