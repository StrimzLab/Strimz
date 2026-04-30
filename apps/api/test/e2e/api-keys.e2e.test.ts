import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedApiKey, seedMerchant } from '../helpers/fixtures.js'

describe('api-key auth e2e', () => {
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

  it('rejects requests with no Authorization header', async () => {
    const res = await t.inject({ method: 'GET', url: '/v1/subscriptions' })
    expect(res.statusCode).toBe(401)
  })

  it('rejects an unknown API key', async () => {
    const res = await t.inject({
      method: 'GET',
      url: '/v1/subscriptions',
      headers: { authorization: 'Bearer sk_test_thisIsNotAValidKey0000000000000000' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('rejects a key from a different kind (publishable)', async () => {
    const m = await seedMerchant(t.prisma.db)
    const k = await seedApiKey(t.prisma.db, m.id, {
      kind: 'publishable',
      scopes: ['sessions_read'],
    })
    const res = await t.inject({
      method: 'GET',
      url: '/v1/subscriptions',
      headers: { authorization: `Bearer ${k.secretKey}` },
    })
    expect(res.statusCode).toBe(401)
  })

  it('accepts a valid secret key with correct scope', async () => {
    const m = await seedMerchant(t.prisma.db)
    const k = await seedApiKey(t.prisma.db, m.id, { scopes: ['subscriptions_read'] })
    const res = await t.inject({
      method: 'GET',
      url: '/v1/subscriptions',
      headers: { authorization: `Bearer ${k.secretKey}` },
    })
    expect(res.statusCode).toBe(200)
  })

  it('rejects a valid key missing the required scope', async () => {
    const m = await seedMerchant(t.prisma.db)
    const k = await seedApiKey(t.prisma.db, m.id, { scopes: ['sessions_read'] })
    const res = await t.inject({
      method: 'GET',
      url: '/v1/subscriptions',
      headers: { authorization: `Bearer ${k.secretKey}` },
    })
    expect(res.statusCode).toBe(403)
    expect(JSON.parse(res.body).error.code).toBe('permission_denied')
  })

  it('rejects a revoked key', async () => {
    const m = await seedMerchant(t.prisma.db)
    const k = await seedApiKey(t.prisma.db, m.id, { revoked: true })
    const res = await t.inject({
      method: 'GET',
      url: '/v1/subscriptions',
      headers: { authorization: `Bearer ${k.secretKey}` },
    })
    expect(res.statusCode).toBe(401)
  })
})
