import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedApiKey, seedMerchant } from '../helpers/fixtures.js'

const SUCCESS = 'https://app.example/welcome?sub={SUBSCRIPTION_ID}&tx={ON_CHAIN_TX_HASH}'
const CANCEL = 'https://app.example/pricing'
const PLAN = { name: 'Pro', amount: '20000000', currency: 'USDC', interval: 'monthly' }

describe('subscription plan return URLs', () => {
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

  async function merchantKey(onchainMerchantId: number, scopes?: string[]) {
    const m = await seedMerchant(t.prisma.db, { onboardingCompleted: true, onchainMerchantId })
    const k = await seedApiKey(t.prisma.db, m.id, scopes ? { scopes } : {})
    return { m, key: k.secretKey }
  }

  const send = (
    method: 'POST' | 'PATCH' | 'GET',
    key: string | null,
    url: string,
    payload?: object,
  ) =>
    t.inject({
      method,
      url,
      ...(key ? { headers: { authorization: `Bearer ${key}` } } : {}),
      ...(payload ? { payload } : {}),
    })

  const body = (res: { body: string }) => JSON.parse(res.body) as Record<string, unknown>
  const errorCode = (res: { body: string }) =>
    (JSON.parse(res.body) as { error: { code: string } }).error.code

  async function createPlan(key: string, extra: object = {}) {
    const res = await send('POST', key, '/v1/subscription-plans', { ...PLAN, ...extra })
    expect(res.statusCode).toBe(201)
    return body(res).id as string
  }

  it('stores the URLs given at creation, placeholders intact', async () => {
    const { key } = await merchantKey(1)

    const id = await createPlan(key, { successUrl: SUCCESS, cancelUrl: CANCEL })

    const res = await send('GET', key, `/v1/subscription-plans/${id}`)
    expect(body(res)).toMatchObject({ successUrl: SUCCESS, cancelUrl: CANCEL })
  })

  it('defaults both URLs to null', async () => {
    const { key } = await merchantKey(1)

    const id = await createPlan(key)

    expect(body(await send('GET', key, `/v1/subscription-plans/${id}`))).toMatchObject({
      successUrl: null,
      cancelUrl: null,
    })
  })

  it('sets, keeps and clears URLs with PATCH', async () => {
    const { key } = await merchantKey(1)
    const id = await createPlan(key, { cancelUrl: CANCEL })

    const set = await send('PATCH', key, `/v1/subscription-plans/${id}`, { successUrl: SUCCESS })
    expect(set.statusCode).toBe(200)
    expect(body(set)).toMatchObject({ successUrl: SUCCESS, cancelUrl: CANCEL })

    const cleared = await send('PATCH', key, `/v1/subscription-plans/${id}`, { cancelUrl: null })
    expect(body(cleared)).toMatchObject({ successUrl: SUCCESS, cancelUrl: null })
  })

  it('edits an archived plan', async () => {
    const { key } = await merchantKey(1)
    const id = await createPlan(key)
    await send('POST', key, `/v1/subscription-plans/${id}/archive`, {})

    const res = await send('PATCH', key, `/v1/subscription-plans/${id}`, { successUrl: SUCCESS })

    expect(res.statusCode).toBe(200)
    expect(body(res)).toMatchObject({ status: 'archived', successUrl: SUCCESS })
  })

  it('refuses anything but the return URLs, and a non-http URL', async () => {
    const { key } = await merchantKey(1)
    const id = await createPlan(key)

    const price = await send('PATCH', key, `/v1/subscription-plans/${id}`, { amount: '1' })
    const scheme = await send('PATCH', key, `/v1/subscription-plans/${id}`, {
      successUrl: 'javascript:alert(1)',
    })

    expect(price.statusCode).toBe(400)
    expect(scheme.statusCode).toBe(400)
    const row = await t.prisma.db.subscriptionPlan.findUniqueOrThrow({ where: { id } })
    expect(row.amount).toBe(PLAN.amount)
    expect(row.successUrl).toBeNull()
  })

  it("doesn't let one merchant edit another's plan", async () => {
    const a = await merchantKey(1)
    const b = await merchantKey(2)
    const id = await createPlan(a.key)

    const res = await send('PATCH', b.key, `/v1/subscription-plans/${id}`, { successUrl: SUCCESS })

    expect(res.statusCode).toBe(404)
    expect(errorCode(res)).toBe('not_found')
    const row = await t.prisma.db.subscriptionPlan.findUniqueOrThrow({ where: { id } })
    expect(row.successUrl).toBeNull()
  })

  it('needs the subscriptions write scope', async () => {
    const owner = await merchantKey(1)
    const id = await createPlan(owner.key)
    const readOnly = await seedApiKey(t.prisma.db, owner.m.id, { scopes: ['subscriptions_read'] })

    const res = await send('PATCH', readOnly.secretKey, `/v1/subscription-plans/${id}`, {
      successUrl: SUCCESS,
    })

    expect(res.statusCode).toBe(403)
  })

  it('returns the URLs on the public checkout plan', async () => {
    const { key } = await merchantKey(1)
    const id = await createPlan(key, { successUrl: SUCCESS, cancelUrl: CANCEL })

    const res = await send('GET', null, `/v1/checkout/plans/${id}`)

    expect(res.statusCode).toBe(200)
    expect(body(res)).toMatchObject({ successUrl: SUCCESS, cancelUrl: CANCEL })
  })
})
