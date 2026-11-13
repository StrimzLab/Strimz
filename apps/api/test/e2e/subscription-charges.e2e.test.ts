import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { SubscriptionChargeOutcome, SubscriptionChargeStatus } from '@strimz/db'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedApiKey, seedMerchant, seedSubscription } from '../helpers/fixtures.js'

const HOUR = 3_600_000

describe('GET /v1/subscriptions/:id/charges', () => {
  let t: TestApp
  let attempt = 0

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
  })

  const charge = (
    sub: { id: string; merchantId: string },
    status: SubscriptionChargeStatus,
    outcome: SubscriptionChargeOutcome | null,
    hoursAgo: number,
  ) => {
    attempt += 1
    const at = new Date(Date.now() - hoursAgo * HOUR)
    return t.prisma.db.subscriptionCharge.create({
      data: {
        subscriptionId: sub.id,
        merchantId: sub.merchantId,
        chargeAttemptId: `0x${attempt.toString(16).padStart(64, '0')}`,
        periodStartAt: at,
        periodEndAt: new Date(at.getTime() + 720 * HOUR),
        amount: '20000000',
        currency: 'USDC',
        status,
        outcome,
        scheduledAt: at,
        executedAt: outcome ? at : null,
        onchainTxHash: outcome === 'charged' ? `0x${'a'.repeat(64)}` : null,
      },
    })
  }

  const get = (token: string, url: string) =>
    t.inject({ method: 'GET', url, headers: { authorization: `Bearer ${token}` } })

  it('lists every attempt newest first, including skipped and failed ones', async () => {
    const m = await seedMerchant(t.prisma.db)
    const k = await seedApiKey(t.prisma.db, m.id, { scopes: ['subscriptions_read'] })
    const sub = await seedSubscription(t.prisma.db, m.id)
    const paid = await charge(sub, 'succeeded', 'charged', 72)
    const broke = await charge(sub, 'failed', 'insufficient_funds', 48)
    const delisted = await charge(sub, 'failed', 'token_not_allowed', 24)

    const res = await get(k.secretKey, `/v1/subscriptions/${sub.id}/charges`)

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body) as {
      data: { id: string; status: string; outcome: string | null; onchainTxHash: string | null }[]
      hasMore: boolean
      nextCursor: string | null
    }
    expect(body.data.map((c) => c.id)).toEqual([delisted.id, broke.id, paid.id])
    expect(body.data[0]).toMatchObject({ status: 'failed', outcome: 'token_not_allowed' })
    expect(body.data[2]).toMatchObject({ outcome: 'charged', onchainTxHash: `0x${'a'.repeat(64)}` })
    expect(body).toMatchObject({ hasMore: false, nextCursor: null })
  })

  it('pages with a cursor', async () => {
    const m = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, m.id)
    const older = await charge(sub, 'succeeded', 'charged', 48)
    const newer = await charge(sub, 'failed', 'revoked_approval', 24)

    const first = JSON.parse(
      (await get(m.privyAccessToken, `/v1/subscriptions/${sub.id}/charges?limit=1`)).body,
    )
    expect(first.data.map((c: { id: string }) => c.id)).toEqual([newer.id])
    expect(first).toMatchObject({ hasMore: true, nextCursor: newer.id })

    const second = JSON.parse(
      (
        await get(
          m.privyAccessToken,
          `/v1/subscriptions/${sub.id}/charges?limit=1&cursor=${first.nextCursor}`,
        )
      ).body,
    )
    expect(second.data.map((c: { id: string }) => c.id)).toEqual([older.id])
    expect(second.hasMore).toBe(false)
  })

  it("returns 404 for another merchant's subscription or the other mode", async () => {
    const owner = await seedMerchant(t.prisma.db)
    const other = await seedMerchant(t.prisma.db)
    const sub = await seedSubscription(t.prisma.db, owner.id)
    const liveSub = await seedSubscription(t.prisma.db, owner.id, { mode: 'live' })
    const testKey = await seedApiKey(t.prisma.db, owner.id, { scopes: ['subscriptions_read'] })

    const cross = await get(other.privyAccessToken, `/v1/subscriptions/${sub.id}/charges`)
    expect(cross.statusCode).toBe(404)
    expect(JSON.parse(cross.body).error.code).toBe('not_found')
    expect(
      (await get(testKey.secretKey, `/v1/subscriptions/${liveSub.id}/charges`)).statusCode,
    ).toBe(404)
  })

  it('needs the subscriptions_read scope', async () => {
    const m = await seedMerchant(t.prisma.db)
    const k = await seedApiKey(t.prisma.db, m.id, { scopes: ['sessions_read'] })
    const sub = await seedSubscription(t.prisma.db, m.id)

    const res = await get(k.secretKey, `/v1/subscriptions/${sub.id}/charges`)

    expect(res.statusCode).toBe(403)
  })
})
