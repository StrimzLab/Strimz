import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import {
  seedApiKey,
  seedMerchant,
  seedPaymentSession,
  seedSubscription,
  seedTransaction,
} from '../helpers/fixtures.js'

describe('transactions list filters', () => {
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

  async function list(secretKey: string, query: string) {
    const res = await t.inject({
      method: 'GET',
      url: `/v1/transactions?${query}`,
      headers: { authorization: `Bearer ${secretKey}` },
    })
    return res
  }

  const ids = (body: string) => (JSON.parse(body).data as Array<{ id: string }>).map((tx) => tx.id)

  it('lists only the transactions of one payment session', async () => {
    const m = await seedMerchant(t.prisma.db)
    const k = await seedApiKey(t.prisma.db, m.id, { scopes: ['transactions_read'] })
    const session = await seedPaymentSession(t.prisma.db, m.id)
    const other = await seedPaymentSession(t.prisma.db, m.id)
    const paid = await seedTransaction(t.prisma.db, m.id, { sessionId: session.id })
    await seedTransaction(t.prisma.db, m.id, { sessionId: other.id })
    await seedTransaction(t.prisma.db, m.id)

    const res = await list(k.secretKey, `sessionId=${session.id}`)

    expect(res.statusCode).toBe(200)
    expect(ids(res.body)).toEqual([paid.id])
  })

  it('lists only the charges of one subscription', async () => {
    const m = await seedMerchant(t.prisma.db)
    const k = await seedApiKey(t.prisma.db, m.id, { scopes: ['transactions_read'] })
    const sub = await seedSubscription(t.prisma.db, m.id)
    const charge = await seedTransaction(t.prisma.db, m.id, { subscriptionId: sub.id })
    await seedTransaction(t.prisma.db, m.id)

    const res = await list(k.secretKey, `subscriptionId=${sub.id}`)

    expect(res.statusCode).toBe(200)
    expect(ids(res.body)).toEqual([charge.id])
  })

  it("does not show another merchant's transactions for their session id", async () => {
    const owner = await seedMerchant(t.prisma.db)
    const intruder = await seedMerchant(t.prisma.db)
    const k = await seedApiKey(t.prisma.db, intruder.id, { scopes: ['transactions_read'] })
    const session = await seedPaymentSession(t.prisma.db, owner.id)
    await seedTransaction(t.prisma.db, owner.id, { sessionId: session.id })

    const res = await list(k.secretKey, `sessionId=${session.id}`)

    expect(res.statusCode).toBe(200)
    expect(ids(res.body)).toEqual([])
  })

  it('refuses a malformed id with 400', async () => {
    const m = await seedMerchant(t.prisma.db)
    const k = await seedApiKey(t.prisma.db, m.id, { scopes: ['transactions_read'] })

    const res = await list(k.secretKey, `sessionId=${encodeURIComponent('bad id;')}`)

    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error.code).toBe('invalid_request')
  })
})
