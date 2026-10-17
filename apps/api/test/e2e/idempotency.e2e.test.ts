import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedApiKey, seedMerchant } from '../helpers/fixtures.js'
import { must } from '../helpers/must.js'

const KEY_HEADER = 'x-strimz-idempotency-key'
const REPLAYED = 'x-strimz-idempotent-replayed'
const session = { amount: '1000000', currency: 'USDC', description: 'Order 1' }

describe('idempotency keys e2e', () => {
  let t: TestApp

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    t.redis.reset()
  })

  let wallet = 0xc1
  async function merchantKey(scopes?: string[]) {
    const m = await seedMerchant(t.prisma.db, {
      onboardingCompleted: true,
      walletAddress: `0x${(wallet++).toString(16).padStart(40, '0')}`,
      onchainMerchantId: wallet,
    })
    const k = await seedApiKey(t.prisma.db, m.id, scopes ? { scopes } : {})
    return k.secretKey
  }

  function createSession(secret: string, key: string | undefined, payload: object = session) {
    return t.inject({
      method: 'POST',
      url: '/v1/payment-sessions',
      headers: { authorization: `Bearer ${secret}`, ...(key ? { [KEY_HEADER]: key } : {}) },
      payload,
    })
  }

  it('replays the first response for the same key and body', async () => {
    const secret = await merchantKey()
    const first = await createSession(secret, 'order-1')
    const second = await createSession(secret, 'order-1')

    expect(first.statusCode).toBe(201)
    expect(first.headers[REPLAYED]).toBeUndefined()
    expect(second.statusCode).toBe(201)
    expect(second.headers[REPLAYED]).toBe('true')
    expect(JSON.parse(second.body).id).toBe(JSON.parse(first.body).id)
    expect(await t.prisma.db.paymentSession.count()).toBe(1)
  })

  it('refuses the same key with a different body', async () => {
    const secret = await merchantKey()
    await createSession(secret, 'order-1')
    const res = await createSession(secret, 'order-1', { ...session, amount: '2000000' })

    expect(res.statusCode).toBe(409)
    expect(JSON.parse(res.body).error.code).toBe('idempotency_error')
    expect(await t.prisma.db.paymentSession.count()).toBe(1)
  })

  it('keeps keys separate per merchant', async () => {
    const a = await merchantKey()
    const b = await merchantKey()
    const first = await createSession(a, 'order-1')
    const second = await createSession(b, 'order-1')

    expect(second.statusCode).toBe(201)
    expect(second.headers[REPLAYED]).toBeUndefined()
    expect(JSON.parse(second.body).id).not.toBe(JSON.parse(first.body).id)
    expect(await t.prisma.db.paymentSession.count()).toBe(2)
  })

  it('replays a stored validation error', async () => {
    const secret = await merchantKey()
    const bad = { ...session, amount: '1.5' }
    const first = await createSession(secret, 'order-1', bad)
    const second = await createSession(secret, 'order-1', bad)

    expect(first.statusCode).toBe(400)
    expect(second.statusCode).toBe(400)
    expect(second.headers[REPLAYED]).toBe('true')
    expect(JSON.parse(second.body).error).toMatchObject({
      code: 'invalid_request',
      param: 'amount',
    })
  })

  it('answers a concurrent repeat with idempotency_in_progress', async () => {
    const secret = await merchantKey()
    const results = await Promise.all([
      createSession(secret, 'order-1'),
      createSession(secret, 'order-1'),
    ])
    const statuses = results.map((r) => r.statusCode).sort()

    expect(statuses).toEqual([201, 409])
    const busy = must(
      results.find((r) => r.statusCode === 409),
      '409 response',
    )
    expect(JSON.parse(busy.body).error.code).toBe('idempotency_in_progress')
    expect(busy.headers['retry-after']).toBe('1')
    expect(await t.prisma.db.paymentSession.count()).toBe(1)
  })

  it('rejects a key longer than 255 characters', async () => {
    const secret = await merchantKey()
    const res = await createSession(secret, 'k'.repeat(256))

    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error).toMatchObject({
      code: 'invalid_request',
      param: 'X-Strimz-Idempotency-Key',
    })
    expect(await t.prisma.db.paymentSession.count()).toBe(0)
  })

  it('creates twice without a key', async () => {
    const secret = await merchantKey()
    await createSession(secret, undefined)
    await createSession(secret, undefined)

    expect(await t.prisma.db.paymentSession.count()).toBe(2)
  })

  it('fails with 503 instead of skipping the check when Redis is down', async () => {
    const secret = await merchantKey()
    const set = t.redis.client.set
    t.redis.client.set = () => Promise.reject(new Error('connection refused'))
    try {
      const res = await createSession(secret, 'order-1')
      expect(res.statusCode).toBe(503)
    } finally {
      t.redis.client.set = set
    }
    expect(await t.prisma.db.paymentSession.count()).toBe(0)
  })

  it('never stores a response that carries a new API key', async () => {
    const secret = await merchantKey(['api_keys_write', 'sessions_read'])
    const mint = () =>
      t.inject({
        method: 'POST',
        url: '/v1/api-keys',
        headers: { authorization: `Bearer ${secret}`, [KEY_HEADER]: 'mint-1' },
        payload: { name: 'ci', kind: 'secret', mode: 'test', scopes: ['sessions_read'] },
      })
    const first = await mint()
    const second = await mint()

    expect(first.statusCode).toBe(201)
    expect(second.statusCode).toBe(201)
    expect(second.headers[REPLAYED]).toBeUndefined()
    expect(t.redis.keys().some((k) => k.startsWith('idem:'))).toBe(false)
  })
})
