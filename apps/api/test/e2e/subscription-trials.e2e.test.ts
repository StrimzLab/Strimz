import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedApiKey, seedMerchant, seedPlan, seedSubscription } from '../helpers/fixtures.js'

const USDC = '0x3600000000000000000000000000000000000000'
const PAYER = `0x${'d'.repeat(40)}`
const DAY = 86_400
const MONTH_SECONDS = 30 * DAY

describe('subscription trials', () => {
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

  const nowSeconds = () => Math.floor(Date.now() / 1000)

  const terms = (planId: string, payer = PAYER) =>
    t.inject({ method: 'GET', url: `/v1/checkout/plans/${planId}/terms?payer=${payer}` })

  async function setup(trialPeriodDays: number | null) {
    const m = await seedMerchant(t.prisma.db, { onboardingCompleted: true, onchainMerchantId: 1 })
    const k = await seedApiKey(t.prisma.db, m.id, { scopes: ['relay_write'] })
    const plan = await seedPlan(t.prisma.db, m.id, {
      ...(trialPeriodDays === null ? {} : { trialPeriodDays }),
    })
    return { m, k, plan }
  }

  const enrol = (secretKey: string, planId: string, over: Record<string, unknown> = {}) =>
    t.inject({
      method: 'POST',
      url: '/v1/relay/subscriptions',
      headers: { authorization: `Bearer ${secretKey}` },
      payload: {
        idempotencyKey: `${planId}-${PAYER}`,
        merchantId: '1',
        token: USDC,
        amount: '20000000',
        interval: MONTH_SECONDS,
        startAt: '0',
        endAt: '0',
        permitData: { owner: PAYER, value: '20000000', deadline: '9999999999' },
        permitSignature: { v: 27, r: `0x${'1'.repeat(64)}`, s: `0x${'2'.repeat(64)}` },
        intentSignature: { v: 27, r: `0x${'3'.repeat(64)}`, s: `0x${'4'.repeat(64)}` },
        subscriptionInternalId: planId,
        ...over,
      },
    })

  const relayJobs = () => t.queue.jobsFor('strimz.relay.submission')

  describe('terms endpoint', () => {
    it('starts a new payer on a trial plan after the trial', async () => {
      const { plan } = await setup(14)
      const before = nowSeconds()
      const res = await terms(plan.id)
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.trialDays).toBe(14)
      expect(Number(body.startAt)).toBeGreaterThanOrEqual(before + 14 * DAY)
      expect(Number(body.startAt)).toBeLessThanOrEqual(nowSeconds() + 14 * DAY)
      expect(new Date(body.trialEndsAt).getTime()).toBe(Number(body.startAt) * 1000)
    })

    it('gives no second trial to a payer who subscribed to the plan before', async () => {
      const { m, plan } = await setup(14)
      await seedSubscription(t.prisma.db, m.id, {
        planId: plan.id,
        payerAddress: PAYER,
        status: 'cancelled',
      })
      const body = JSON.parse((await terms(plan.id, PAYER.toUpperCase().replace('0X', '0x'))).body)
      expect(body).toEqual({ startAt: '0', trialDays: 0, trialEndsAt: null })
    })

    it('charges at once on a plan without a trial', async () => {
      const { plan } = await setup(null)
      expect(JSON.parse((await terms(plan.id)).body)).toEqual({
        startAt: '0',
        trialDays: 0,
        trialEndsAt: null,
      })
    })

    it('rejects a malformed payer and an unknown plan', async () => {
      const { plan } = await setup(14)
      expect((await terms(plan.id, 'nope')).statusCode).toBe(400)
      expect((await terms('plan_missing')).statusCode).toBe(404)
    })
  })

  describe('relay enrolment', () => {
    it('accepts terms that match the plan and its trial', async () => {
      const { k, plan } = await setup(14)
      const res = await enrol(k.secretKey, plan.id, { startAt: String(nowSeconds() + 14 * DAY) })
      expect(res.statusCode).toBe(201)
      expect(relayJobs()).toHaveLength(1)
    })

    it('refuses to charge an eligible payer at once on a trial plan', async () => {
      const { k, plan } = await setup(14)
      const res = await enrol(k.secretKey, plan.id, { startAt: '0' })
      expect(res.statusCode).toBe(400)
      const err = JSON.parse(res.body).error
      expect(err.code).toBe('enrolment_terms_mismatch')
      expect(err.message).toContain('startAt')
      expect(relayJobs()).toHaveLength(0)
    })

    it('refuses a start outside the 15 minute window', async () => {
      const { k, plan } = await setup(14)
      const res = await enrol(k.secretKey, plan.id, {
        startAt: String(nowSeconds() + 14 * DAY + 3600),
      })
      expect(res.statusCode).toBe(400)
      expect(relayJobs()).toHaveLength(0)
    })

    it('refuses a trial start for a payer who already used the trial', async () => {
      const { m, k, plan } = await setup(14)
      await seedSubscription(t.prisma.db, m.id, {
        planId: plan.id,
        payerAddress: PAYER,
        status: 'cancelled',
      })
      const res = await enrol(k.secretKey, plan.id, { startAt: String(nowSeconds() + 14 * DAY) })
      expect(res.statusCode).toBe(400)
    })

    it('refuses an amount, interval, token or end that differs from the plan', async () => {
      const { k, plan } = await setup(null)
      for (const over of [
        { amount: '1' },
        { interval: 7 * DAY },
        { token: `0x${'9'.repeat(40)}` },
        { endAt: String(nowSeconds() + 400 * DAY) },
        { merchantId: '2' },
      ]) {
        const res = await enrol(k.secretKey, plan.id, over)
        expect(res.statusCode, JSON.stringify(over)).toBe(400)
      }
      expect(relayJobs()).toHaveLength(0)
    })

    it("refuses another merchant's plan", async () => {
      const { k } = await setup(null)
      const other = await seedMerchant(t.prisma.db, { onchainMerchantId: 2 })
      const foreign = await seedPlan(t.prisma.db, other.id)
      const res = await enrol(k.secretKey, foreign.id)
      expect(res.statusCode).toBe(400)
      expect(relayJobs()).toHaveLength(0)
    })

    it('leaves enrolments without a plan id to the merchant', async () => {
      const { k } = await setup(null)
      const res = await enrol(k.secretKey, 'unused', { subscriptionInternalId: undefined })
      expect(res.statusCode).toBe(201)
      expect(relayJobs()).toHaveLength(1)
    })
  })
})
