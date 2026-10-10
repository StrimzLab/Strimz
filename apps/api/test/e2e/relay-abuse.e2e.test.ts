import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { keccak256, stringToHex, toHex } from 'viem'
import { QUEUE_NAMES, relayJobSchema } from '@strimz/queue-contracts'
import { checkoutPaymentNonce } from '@strimz/shared-crypto/checkout'

import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { must } from '../helpers/must.js'
import {
  seedApiKey,
  seedMerchant,
  seedPaymentSession,
  seedPlan,
  seedStorefront,
} from '../helpers/fixtures.js'

const USDC = '0x3600000000000000000000000000000000000000'
const OTHER_TOKEN = `0x${'e'.repeat(40)}`
const PAYER = `0x${'d'.repeat(40)}`
const AMOUNT = '100000000'
const BELOW_MINIMUM = '999999'
const MONTH_SECONDS = 30 * 86_400
const DAY_SECONDS = 86_400
const OPS_ALERT_EMAIL = 'ops@strimz.test'

describe('relay abuse e2e', () => {
  let t: TestApp
  let ipCounter = 0
  let remoteAddress = '203.0.113.0'

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    t.queue.reset()
    t.chain.reset()
    t.redis.reset()
    t.email.reset()
    ipCounter += 1
    remoteAddress = `203.0.113.${ipCounter}`
  })

  const relayJobs = () =>
    t.queue.jobsFor(QUEUE_NAMES.relaySubmission).map((j) => relayJobSchema.parse(j.data))

  async function merchants() {
    const a = await seedMerchant(t.prisma.db, { onboardingCompleted: true, onchainMerchantId: 1 })
    const b = await seedMerchant(t.prisma.db, { onboardingCompleted: true, onchainMerchantId: 2 })
    const keyA = await seedApiKey(t.prisma.db, a.id, { scopes: ['relay_write', 'relay_read'] })
    return { a, b, keyA }
  }

  function payment(over: {
    merchantId: string
    amount?: string
    nonce?: string
    sessionId?: string
    from?: string
    token?: string
    tag?: string
  }) {
    const tag = over.tag ?? 'payer'
    return {
      merchantId: over.merchantId,
      token: over.token ?? USDC,
      auth: {
        from: over.from ?? PAYER,
        amount: over.amount ?? AMOUNT,
        validAfter: '0',
        validBefore: String(Math.floor(Date.now() / 1000) + 300),
        nonce:
          over.nonce ??
          (over.sessionId ? checkoutPaymentNonce(over.sessionId) : keccak256(toHex(tag))),
      },
      ref: stringToHex(over.sessionId ?? tag, { size: 32 }),
      authSignature: { v: 27, r: keccak256(toHex(`auth-r-${tag}`)), s: `0x${'2'.repeat(64)}` },
      intentSignature: { v: 27, r: keccak256(toHex(`intent-r-${tag}`)), s: `0x${'4'.repeat(64)}` },
      ...(over.sessionId ? { sessionId: over.sessionId } : {}),
    }
  }

  function enrolment(over: { merchantId: string; amount?: string; planId?: string }) {
    const amount = over.amount ?? '20000000'
    return {
      merchantId: over.merchantId,
      token: USDC,
      amount,
      interval: MONTH_SECONDS,
      startAt: '0',
      endAt: '0',
      permitData: { owner: PAYER, value: amount, deadline: '9999999999' },
      permitSignature: { v: 27, r: `0x${'1'.repeat(64)}`, s: `0x${'2'.repeat(64)}` },
      intentSignature: { v: 27, r: `0x${'3'.repeat(64)}`, s: `0x${'4'.repeat(64)}` },
      ...(over.planId ? { subscriptionInternalId: over.planId } : {}),
    }
  }

  const merchantRelay = (
    secretKey: string,
    path: 'payments' | 'subscriptions',
    payload: Record<string, unknown>,
    ip = remoteAddress,
  ) =>
    t.inject({
      method: 'POST',
      url: `/v1/relay/${path}`,
      remoteAddress: ip,
      headers: { authorization: `Bearer ${secretKey}` },
      payload,
    })

  const hostedPayment = (sessionId: string, payload: Record<string, unknown>) =>
    t.inject({
      method: 'POST',
      url: `/v1/checkout/sessions/${sessionId}/relay`,
      remoteAddress,
      payload,
    })

  const hostedEnrolment = (planId: string, payload: Record<string, unknown>) =>
    t.inject({
      method: 'POST',
      url: `/v1/checkout/plans/${planId}/relay`,
      remoteAddress,
      payload,
    })

  const errorCode = (body: string) => (JSON.parse(body) as { error: { code: string } }).error.code

  describe('merchant API key relay', () => {
    it('refuses a session payment below the minimum amount', async () => {
      const { a, keyA } = await merchants()
      const session = await seedPaymentSession(t.prisma.db, a.id, {
        status: 'awaiting_payment',
        amount: BELOW_MINIMUM,
      })

      const res = await merchantRelay(
        keyA.secretKey,
        'payments',
        payment({ merchantId: '1', sessionId: session.id, amount: BELOW_MINIMUM }),
      )

      expect(res.statusCode).toBe(400)
      expect(errorCode(res.body)).toBe('amount_below_minimum')
      expect(relayJobs()).toHaveLength(0)
    })

    it("refuses a token that is not the session's currency", async () => {
      const { a, keyA } = await merchants()
      const session = await seedPaymentSession(t.prisma.db, a.id, {
        status: 'awaiting_payment',
        amount: AMOUNT,
      })

      const res = await merchantRelay(
        keyA.secretKey,
        'payments',
        payment({ merchantId: '1', sessionId: session.id, token: OTHER_TOKEN }),
      )

      expect(res.statusCode).toBe(400)
      expect(errorCode(res.body)).toBe('token_mismatch')
      expect(relayJobs()).toHaveLength(0)
    })

    it('limits one merchant to 60 relay calls a minute across addresses', async () => {
      const { a, keyA } = await merchants()
      const session = await seedPaymentSession(t.prisma.db, a.id, {
        status: 'awaiting_payment',
        amount: AMOUNT,
      })
      const body = payment({ merchantId: '1', sessionId: session.id })

      for (let i = 0; i < 60; i += 1) {
        const ok = await merchantRelay(keyA.secretKey, 'payments', body, `198.18.${ipCounter}.${i}`)
        expect(ok.statusCode).toBe(201)
      }
      const limited = await merchantRelay(
        keyA.secretKey,
        'payments',
        body,
        `198.18.${ipCounter}.200`,
      )

      expect(limited.statusCode).toBe(429)
      expect(errorCode(limited.body)).toBe('rate_limited')
    })
  })

  describe('hosted checkout relay without an API key', () => {
    it("relays a payment for any merchant's session and attributes it to that merchant", async () => {
      const { b } = await merchants()
      const session = await seedPaymentSession(t.prisma.db, b.id, {
        status: 'awaiting_payment',
        amount: AMOUNT,
      })
      const { sessionId: _sessionId, ...body } = payment({
        merchantId: '2',
        sessionId: session.id,
      })

      const res = await hostedPayment(session.id, body)

      expect(res.statusCode).toBe(201)
      const job = must(relayJobs()[0])
      expect(job.merchantInternalId).toBe(b.id)
      expect(job.reason === 'payWithAuthorization' && job.sessionId).toBe(session.id)
    })

    it("enrols a payer into any merchant's plan and attributes it to that merchant", async () => {
      const { b } = await merchants()
      const plan = await seedPlan(t.prisma.db, b.id)

      const res = await hostedEnrolment(plan.id, enrolment({ merchantId: '2' }))

      expect(res.statusCode).toBe(201)
      const job = must(relayJobs()[0])
      expect(job.merchantInternalId).toBe(b.id)
      expect(job.reason === 'permitAndCreateSubscription' && job.subscriptionInternalId).toBe(
        plan.id,
      )
    })

    it('refuses a payment whose merchant is not the session merchant', async () => {
      const { b } = await merchants()
      const session = await seedPaymentSession(t.prisma.db, b.id, {
        status: 'awaiting_payment',
        amount: AMOUNT,
      })
      const { sessionId: _sessionId, ...body } = payment({
        merchantId: '1',
        sessionId: session.id,
      })

      const res = await hostedPayment(session.id, body)

      expect(res.statusCode).toBe(400)
      expect(errorCode(res.body)).toBe('invalid_request')
      expect(relayJobs()).toHaveLength(0)
    })

    it('refuses an enrolment into a plan below the minimum amount', async () => {
      const { b } = await merchants()
      const plan = await seedPlan(t.prisma.db, b.id, { amount: BELOW_MINIMUM })

      const res = await hostedEnrolment(
        plan.id,
        enrolment({ merchantId: '2', amount: BELOW_MINIMUM }),
      )

      expect(res.statusCode).toBe(400)
      expect(errorCode(res.body)).toBe('amount_below_minimum')
      expect(relayJobs()).toHaveLength(0)
    })

    it('returns the submission to its own session only', async () => {
      const { b } = await merchants()
      const session = await seedPaymentSession(t.prisma.db, b.id, {
        status: 'awaiting_payment',
        amount: AMOUNT,
      })
      const other = await seedPaymentSession(t.prisma.db, b.id, {
        status: 'awaiting_payment',
        amount: AMOUNT,
      })
      const { sessionId: _sessionId, ...body } = payment({
        merchantId: '2',
        sessionId: session.id,
      })
      const submitted = await hostedPayment(session.id, body)
      expect(submitted.statusCode).toBe(201)
      const key = (JSON.parse(submitted.body) as { idempotencyKey: string }).idempotencyKey

      const own = await t.inject({
        method: 'GET',
        url: `/v1/checkout/sessions/${session.id}/submissions/${key}`,
        remoteAddress,
      })
      const foreign = await t.inject({
        method: 'GET',
        url: `/v1/checkout/sessions/${other.id}/submissions/${key}`,
        remoteAddress,
      })

      expect(own.statusCode).toBe(200)
      expect(foreign.statusCode).toBe(404)
    })

    it('limits one address to 20 hosted relay calls a minute', async () => {
      const { b } = await merchants()
      const session = await seedPaymentSession(t.prisma.db, b.id, {
        status: 'awaiting_payment',
        amount: AMOUNT,
      })
      const { sessionId: _sessionId, ...body } = payment({
        merchantId: '2',
        sessionId: session.id,
      })

      for (let i = 0; i < 20; i += 1) {
        expect((await hostedPayment(session.id, body)).statusCode).toBe(201)
      }
      const limited = await hostedPayment(session.id, body)

      expect(limited.statusCode).toBe(429)
      expect(errorCode(limited.body)).toBe('rate_limited')
    })
  })
  describe('enrolment balance', () => {
    it('refuses an enrolment from a payer holding less than the plan amount', async () => {
      const { b } = await merchants()
      const plan = await seedPlan(t.prisma.db, b.id)
      t.chain.balance = 19_999_999n

      const res = await hostedEnrolment(plan.id, enrolment({ merchantId: '2' }))

      expect(res.statusCode).toBe(400)
      expect(errorCode(res.body)).toBe('insufficient_balance')
      expect(t.chain.balanceReads).toEqual([{ token: USDC, owner: PAYER }])
      expect(t.chain.calls).toHaveLength(0)
      expect(relayJobs()).toHaveLength(0)
    })

    it('refuses an empty payer on a trial plan too', async () => {
      const { b } = await merchants()
      const plan = await seedPlan(t.prisma.db, b.id, { trialPeriodDays: 14 })
      t.chain.balance = 0n

      const res = await hostedEnrolment(plan.id, {
        ...enrolment({ merchantId: '2' }),
        startAt: String(Math.floor(Date.now() / 1000) + 14 * DAY_SECONDS),
      })

      expect(res.statusCode).toBe(400)
      expect(errorCode(res.body)).toBe('insufficient_balance')
      expect(relayJobs()).toHaveLength(0)
    })

    it('enrols a payer holding exactly the plan amount', async () => {
      const { b } = await merchants()
      const plan = await seedPlan(t.prisma.db, b.id)
      t.chain.balance = 20_000_000n

      const res = await hostedEnrolment(plan.id, enrolment({ merchantId: '2' }))

      expect(res.statusCode).toBe(201)
      expect(relayJobs()).toHaveLength(1)
    })
  })

  describe('daily relay budget', () => {
    const today = () => new Date(new Date().toISOString().slice(0, 10))

    const seedUsage = (merchantId: string, submissions: number) =>
      t.prisma.db.relayDailyUsage.create({
        data: { merchantId, day: today(), submissions },
      })

    const usage = (merchantId: string) =>
      t.prisma.db.relayDailyUsage.findUniqueOrThrow({
        where: { merchantId_day: { merchantId, day: today() } },
      })

    const payableSession = (merchantId: string) =>
      seedPaymentSession(t.prisma.db, merchantId, {
        status: 'awaiting_payment',
        amount: AMOUNT,
      })

    it('refuses a new submission once the free daily quota is spent', async () => {
      const { a, keyA } = await merchants()
      const session = await payableSession(a.id)
      await seedUsage(a.id, 500)

      const res = await merchantRelay(
        keyA.secretKey,
        'payments',
        payment({ merchantId: '1', sessionId: session.id }),
      )

      expect(res.statusCode).toBe(429)
      const error = (
        JSON.parse(res.body) as { error: { code: string; details: { retryAfterSec: number } } }
      ).error
      expect(error.code).toBe('relay_budget_exhausted')
      expect(error.details.retryAfterSec).toBeGreaterThan(0)
      expect(error.details.retryAfterSec).toBeLessThanOrEqual(DAY_SECONDS)
      expect(relayJobs()).toHaveLength(0)
      expect((await usage(a.id)).submissions).toBe(500)
    })

    it('counts a new submission once and never a replay', async () => {
      const { a, keyA } = await merchants()
      const first = await payableSession(a.id)
      const second = await payableSession(a.id)
      await seedUsage(a.id, 499)
      const body = payment({ merchantId: '1', sessionId: first.id })

      expect((await merchantRelay(keyA.secretKey, 'payments', body)).statusCode).toBe(201)
      expect((await merchantRelay(keyA.secretKey, 'payments', body)).statusCode).toBe(201)
      const over = await merchantRelay(
        keyA.secretKey,
        'payments',
        payment({ merchantId: '1', sessionId: second.id }),
      )

      expect(over.statusCode).toBe(429)
      expect(errorCode(over.body)).toBe('relay_budget_exhausted')
      expect(relayJobs()).toHaveLength(1)
      expect((await usage(a.id)).submissions).toBe(500)
    })

    it('starts counting at the first submission of the day', async () => {
      const { a, keyA } = await merchants()
      const session = await payableSession(a.id)

      const res = await merchantRelay(
        keyA.secretKey,
        'payments',
        payment({ merchantId: '1', sessionId: session.id }),
      )

      expect(res.statusCode).toBe(201)
      const row = await usage(a.id)
      expect(row.submissions).toBe(1)
      expect(row.warnedAt).toBeNull()
      expect(t.email.sent).toHaveLength(0)
    })

    it('alerts the operator once at 80% and once at 100%', async () => {
      const { a, keyA } = await merchants()
      const sessions = await Promise.all([1, 2, 3].map(() => payableSession(a.id)))
      await seedUsage(a.id, 399)
      const pay = (sessionId: string) =>
        merchantRelay(keyA.secretKey, 'payments', payment({ merchantId: '1', sessionId }))

      expect((await pay(must(sessions[0]).id)).statusCode).toBe(201)
      expect((await pay(must(sessions[1]).id)).statusCode).toBe(201)

      expect(t.email.sent).toHaveLength(1)
      expect(must(t.email.sent[0]).to).toBe(OPS_ALERT_EMAIL)
      expect(must(t.email.sent[0]).subject).toContain(a.id)
      expect((await usage(a.id)).warnedAt).not.toBeNull()

      await t.prisma.db.relayDailyUsage.update({
        where: { merchantId_day: { merchantId: a.id, day: today() } },
        data: { submissions: 499 },
      })
      expect((await pay(must(sessions[2]).id)).statusCode).toBe(201)

      expect(t.email.sent).toHaveLength(2)
      expect(must(t.email.sent[1]).subject).toContain(a.id)
      expect((await usage(a.id)).exhaustedAt).not.toBeNull()
    })

    it('charges a hosted payment to the merchant who is paid', async () => {
      const { a, b } = await merchants()
      const session = await payableSession(b.id)
      await seedUsage(b.id, 500)
      const { sessionId: _sessionId, ...body } = payment({
        merchantId: '2',
        sessionId: session.id,
      })

      const res = await hostedPayment(session.id, body)

      expect(res.statusCode).toBe(429)
      expect(errorCode(res.body)).toBe('relay_budget_exhausted')
      expect(relayJobs()).toHaveLength(0)
      expect(await t.prisma.db.relayDailyUsage.count({ where: { merchantId: a.id } })).toBe(0)
    })
  })

  describe('minimum amount at creation', () => {
    async function merchantWithKey() {
      const m = await seedMerchant(t.prisma.db, { onboardingCompleted: true, onchainMerchantId: 1 })
      const k = await seedApiKey(t.prisma.db, m.id)
      return { m, k }
    }

    const post = (url: string, token: string, payload: Record<string, unknown>) =>
      t.inject({ method: 'POST', url, headers: { authorization: `Bearer ${token}` }, payload })

    it('refuses a payment session below 1.00 and accepts exactly 1.00', async () => {
      const { k } = await merchantWithKey()

      const below = await post('/v1/payment-sessions', k.secretKey, {
        amount: BELOW_MINIMUM,
        currency: 'USDC',
      })
      const floor = await post('/v1/payment-sessions', k.secretKey, {
        amount: '1000000',
        currency: 'USDC',
      })

      expect(below.statusCode).toBe(400)
      expect(errorCode(below.body)).toBe('amount_below_minimum')
      expect(floor.statusCode).toBe(201)
    })

    it('refuses a subscription plan below 1.00', async () => {
      const { k } = await merchantWithKey()

      const res = await post('/v1/subscription-plans', k.secretKey, {
        name: 'Tiny',
        amount: BELOW_MINIMUM,
        currency: 'USDC',
        interval: 'monthly',
      })

      expect(res.statusCode).toBe(400)
      expect(errorCode(res.body)).toBe('amount_below_minimum')
      expect(await t.prisma.db.subscriptionPlan.count()).toBe(0)
    })

    it('refuses a storefront product below 1.00', async () => {
      const m = await seedMerchant(t.prisma.db, { onboardingCompleted: true, onchainMerchantId: 1 })
      await seedStorefront(t.prisma.db, m.id, `floor-shop-${ipCounter}`)

      const res = await post('/v1/storefront/products', m.privyAccessToken, {
        name: 'Sticker',
        description: null,
        price: BELOW_MINIMUM,
        currency: 'USDC',
        type: 'one_time',
        interval: null,
        intervalCount: null,
        stock: null,
        isActive: true,
      })

      expect(res.statusCode).toBe(400)
      expect(errorCode(res.body)).toBe('amount_below_minimum')
      expect(await t.prisma.db.storefrontProduct.count()).toBe(0)
    })

    it('refuses an invoice whose total is below 1.00', async () => {
      const { k } = await merchantWithKey()

      const res = await post('/v1/invoices', k.secretKey, {
        currency: 'USDC',
        lineItems: [{ description: 'Pin', quantity: 3, unitAmount: '333333' }],
      })

      expect(res.statusCode).toBe(400)
      expect(errorCode(res.body)).toBe('amount_below_minimum')
      expect(await t.prisma.db.invoice.count()).toBe(0)
      expect(await t.prisma.db.paymentSession.count()).toBe(0)
    })
  })
})
