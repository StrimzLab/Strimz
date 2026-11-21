import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { keccak256, stringToHex, toHex, type Hex } from 'viem'
import { QUEUE_NAMES, relayJobSchema } from '@strimz/queue-contracts'
import { checkoutPaymentNonce, subscriptionIntentNonce } from '@strimz/shared-crypto/checkout'
import type { KmsSigner } from '@strimz/signer'

import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { must } from '../helpers/must.js'
import {
  seedApiKey,
  seedMerchant,
  seedPaymentSession,
  seedPlan,
  seedTransaction,
} from '../helpers/fixtures.js'
import { makePrivyDid } from '../helpers/stubs/privy.stub.js'
import { KMS_SIGNER } from '../../src/infra/kms/kms.tokens.js'
import { MerchantChainService } from '../../src/modules/merchants/merchant-chain.service.js'
import { RelayGuardService } from '../../src/modules/relay/relay-guard.service.js'

const USDC = '0x3600000000000000000000000000000000000000'
const AMOUNT = '100000000'
const MONTH_SECONDS = 30 * 86_400

interface RelayRefusal {
  error: {
    code: string
    details: { reason: string; call: { to: Hex; data: Hex; chainId: number } }
  }
}

describe('relay gas protection (ADR-2026-11-21-relay-gas-protection)', () => {
  let t: TestApp
  let relayer: Hex
  let ipCounter = 0
  let ip = '198.51.100.0'

  beforeAll(async () => {
    t = await createTestApp()
    relayer = t.app.get<KmsSigner>(KMS_SIGNER).address
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
    ip = `198.51.100.${ipCounter}`
  })

  const relayJobs = () =>
    t.queue
      .jobsFor(QUEUE_NAMES.relaySubmission)
      .map((j) => relayJobSchema.parse(j.data))
      .filter((j) => j.reason !== 'registerMerchant')
  const refusal = (body: string) => (JSON.parse(body) as RelayRefusal).error
  const payerOf = (n: number): Hex => `0x${n.toString(16).padStart(40, 'd')}`

  function merchant(onchainMerchantId = 1) {
    return seedMerchant(t.prisma.db, { onboardingCompleted: true, onchainMerchantId })
  }

  function payment(sessionId: string, onchainMerchantId: number, from: Hex = payerOf(1)) {
    return {
      merchantId: String(onchainMerchantId),
      token: USDC,
      auth: {
        from,
        amount: AMOUNT,
        validAfter: '0',
        validBefore: String(Math.floor(Date.now() / 1000) + 300),
        nonce: checkoutPaymentNonce(sessionId),
      },
      ref: stringToHex(sessionId, { size: 32 }),
      authSignature: { v: 27, r: keccak256(toHex(`r-${sessionId}`)), s: `0x${'2'.repeat(64)}` },
      intentSignature: { v: 27, r: keccak256(toHex(`i-${sessionId}`)), s: `0x${'4'.repeat(64)}` },
    }
  }

  function enrolment(planId: string, onchainMerchantId: number, owner: Hex) {
    const amount = '20000000'
    return {
      merchantId: String(onchainMerchantId),
      token: USDC,
      amount,
      interval: MONTH_SECONDS,
      startAt: '0',
      endAt: '0',
      nonce: subscriptionIntentNonce(planId, owner, 0n),
      permitData: { owner, value: amount, deadline: '9999999999' },
      permitSignature: {
        v: 27,
        r: keccak256(toHex(`p-${planId}-${owner}`)),
        s: `0x${'2'.repeat(64)}`,
      },
      intentSignature: {
        v: 27,
        r: keccak256(toHex(`e-${planId}-${owner}`)),
        s: `0x${'4'.repeat(64)}`,
      },
    }
  }

  async function pay(merchantId: string, onchainMerchantId = 1, from?: Hex) {
    const session = await seedPaymentSession(t.prisma.db, merchantId, {
      status: 'awaiting_payment',
      amount: AMOUNT,
    })
    return t.inject({
      method: 'POST',
      url: `/v1/checkout/sessions/${session.id}/relay`,
      remoteAddress: ip,
      payload: payment(session.id, onchainMerchantId, from),
    })
  }

  async function enrol(merchantId: string, owner: Hex, onchainMerchantId = 1, from = ip) {
    const plan = await seedPlan(t.prisma.db, merchantId)
    return t.inject({
      method: 'POST',
      url: `/v1/checkout/plans/${plan.id}/relay`,
      remoteAddress: from,
      payload: enrolment(plan.id, onchainMerchantId, owner),
    })
  }

  describe('platform ceiling and floor', () => {
    it('hands the payer the signed call when the platform cap is reached', async () => {
      const m = await merchant()
      t.redis.client.set(`relay:platform:${new Date().toISOString().slice(0, 10)}`, '50000')

      const res = await pay(m.id)

      expect(res.statusCode).toBe(402)
      const error = refusal(res.body)
      expect(error.code).toBe('relay_unavailable')
      expect(error.details.reason).toBe('platform_paused')
      expect(error.details.call.to).toMatch(/^0x[0-9a-fA-F]{40}$/)
      expect(error.details.call.data.startsWith('0x')).toBe(true)
      expect(error.details.call.chainId).toBe(5042002)
      expect(relayJobs()).toHaveLength(0)
    })

    it('emails ops once when the platform cap is reached', async () => {
      const m = await merchant()
      t.redis.client.set(`relay:platform:${new Date().toISOString().slice(0, 10)}`, '49999')

      expect((await pay(m.id)).statusCode).toBe(201)
      expect((await pay(m.id)).statusCode).toBe(402)

      const subjects = t.email.sent.map((e) => e.subject)
      expect(subjects.filter((s) => s.includes('Relay platform cap at 100%'))).toHaveLength(1)
    })

    it('stops paying gas below the balance floor, alerts once and resumes after a top-up', async () => {
      const m = await merchant()
      t.chain.balances.set(relayer.toLowerCase(), 1_999_999n)

      const first = await pay(m.id)
      const second = await pay(m.id)

      expect(first.statusCode).toBe(402)
      expect(refusal(first.body).details.reason).toBe('platform_paused')
      expect(second.statusCode).toBe(402)
      expect(t.email.sent.filter((e) => e.subject.includes('minimum balance'))).toHaveLength(1)
      expect(relayJobs()).toHaveLength(0)

      t.chain.balances.set(relayer.toLowerCase(), 50_000_000n)
      await t.redis.client.del('relay:relayer-usdc')
      expect((await pay(m.id)).statusCode).toBe(201)
    })

    it("doesn't spend the merchant's quota when the platform refuses", async () => {
      const m = await merchant()
      t.chain.balances.set(relayer.toLowerCase(), 0n)

      await pay(m.id)

      expect(await t.prisma.db.relayDailyUsage.count({ where: { merchantId: m.id } })).toBe(0)
    })
  })

  describe('merchant quota', () => {
    it("can't be used to spend the platform cap with refused calls", async () => {
      const m = await merchant()
      const day = new Date().toISOString().slice(0, 10)
      await t.prisma.db.relayDailyUsage.create({
        data: { merchantId: m.id, day: new Date(`${day}T00:00:00Z`), submissions: 50 },
      })

      for (let n = 0; n < 3; n++) expect((await pay(m.id)).statusCode).toBe(402)

      expect(await t.redis.client.get(`relay:platform:${day}`)).toBeNull()
    })

    it("doesn't count a refused signup against the payer", async () => {
      const m = await merchant()
      const day = new Date().toISOString().slice(0, 10)
      await t.prisma.db.relayDailyUsage.create({
        data: { merchantId: m.id, day: new Date(`${day}T00:00:00Z`), submissions: 50 },
      })
      const payer = payerOf(42)

      expect((await enrol(m.id, payer)).statusCode).toBe(402)

      expect(await t.redis.client.get(`relay:enrol:payer:${payer.toLowerCase()}:${day}`)).toBeNull()
    })

    it('falls back to self-pay instead of a dead end when the quota is spent', async () => {
      const m = await merchant()
      await t.prisma.db.relayDailyUsage.create({
        data: {
          merchantId: m.id,
          day: new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`),
          submissions: 500,
        },
      })

      const res = await pay(m.id)

      expect(res.statusCode).toBe(402)
      expect(refusal(res.body).details.reason).toBe('merchant_quota')
    })
  })

  describe('griefing caps on signups', () => {
    it('relays one signup a day per payer for the same merchant', async () => {
      const m = await merchant()
      const payer = payerOf(7)

      expect((await enrol(m.id, payer)).statusCode).toBe(201)
      const again = await enrol(m.id, payer)

      expect(again.statusCode).toBe(402)
      expect(refusal(again.body).details.reason).toBe('payer_limited')
      expect(relayJobs()).toHaveLength(1)
    })

    it('relays at most three signups a day per payer across merchants', async () => {
      const payer = payerOf(8)
      const ms = await Promise.all([1, 2, 3, 4].map((n) => merchant(n)))

      for (const [i, m] of ms.slice(0, 3).entries()) {
        expect((await enrol(m.id, payer, i + 1)).statusCode).toBe(201)
      }
      const fourth = await enrol(must(ms[3]).id, payer, 4)

      expect(fourth.statusCode).toBe(402)
      expect(refusal(fourth.body).details.reason).toBe('payer_limited')
    })

    it('relays at most ten signups a day from one IP for the same merchant', async () => {
      const m = await merchant()
      const sharedIp = '192.0.2.77'

      for (let n = 1; n <= 10; n++) {
        expect((await enrol(m.id, payerOf(100 + n), 1, sharedIp)).statusCode).toBe(201)
      }
      const eleventh = await enrol(m.id, payerOf(200), 1, sharedIp)

      expect(eleventh.statusCode).toBe(402)
      expect(refusal(eleventh.body).details.reason).toBe('ip_limited')
      expect(
        await t.prisma.db.relayDailyUsage.findFirstOrThrow({ where: { merchantId: m.id } }),
      ).toMatchObject({
        submissions: 10,
      })
    })

    it("doesn't apply the per-IP cap to a merchant's own server", async () => {
      const m = await merchant()
      const key = await seedApiKey(t.prisma.db, m.id, { scopes: ['relay_write', 'relay_read'] })
      const guard = t.app.get(RelayGuardService)
      for (let n = 0; n < 3; n++) await guard.recordRevert(undefined, 'ffffffffffffffff')

      const session = await seedPaymentSession(t.prisma.db, m.id, {
        status: 'awaiting_payment',
        amount: AMOUNT,
      })
      const res = await t.inject({
        method: 'POST',
        url: '/v1/relay/payments',
        remoteAddress: ip,
        headers: { authorization: `Bearer ${key.secretKey}` },
        payload: { ...payment(session.id, 1), sessionId: session.id },
      })

      expect(res.statusCode).toBe(201)
      expect(must(relayJobs()[0]).clientKey).toBeUndefined()
    })
  })

  describe('deliberate reverts', () => {
    it('tags each relayed job with its payer and a hashed IP, never the raw IP', async () => {
      const m = await merchant()
      const payer = payerOf(9)

      expect((await pay(m.id, 1, payer)).statusCode).toBe(201)

      const job = must(relayJobs()[0])
      expect(job.payer?.toLowerCase()).toBe(payer.toLowerCase())
      expect(job.clientKey).toMatch(/^[0-9a-f]{16}$/)
      expect(JSON.stringify(job)).not.toContain(ip)
    })

    it('sends a payer to self-pay after two reverts in a day', async () => {
      const m = await merchant()
      const payer = payerOf(10)
      const guard = t.app.get(RelayGuardService)
      await guard.recordRevert(payer, undefined)
      await guard.recordRevert(payer, undefined)

      const res = await pay(m.id, 1, payer)

      expect(res.statusCode).toBe(402)
      expect(refusal(res.body).details.reason).toBe('payer_limited')
      expect(await t.prisma.db.relayDailyUsage.count({ where: { merchantId: m.id } })).toBe(0)
    })

    it('sends an IP to self-pay after two reverts in a day, whatever wallet it uses', async () => {
      const m = await merchant()
      expect((await pay(m.id, 1, payerOf(11))).statusCode).toBe(201)
      const clientKey = must(must(relayJobs()[0]).clientKey)
      const guard = t.app.get(RelayGuardService)
      await guard.recordRevert(undefined, clientKey)
      await guard.recordRevert(undefined, clientKey)

      const res = await pay(m.id, 1, payerOf(12))

      expect(res.statusCode).toBe(402)
      expect(refusal(res.body).details.reason).toBe('ip_limited')
    })
  })

  describe('registration cap', () => {
    const today = () => new Date().toISOString().slice(0, 10)
    const registrationJobs = () =>
      t.queue
        .jobsFor(QUEUE_NAMES.relaySubmission)
        .filter((j) => (j.data as { reason: string }).reason === 'registerMerchant')
    const eligible = () =>
      seedMerchant(t.prisma.db, {
        onboardingCompleted: true,
        walletAddress: `0x${'c'.repeat(40)}`,
      })

    it('registers at once while under the daily cap', async () => {
      const m = await eligible()

      await t.app.get(MerchantChainService).requestRegistration(m.id)

      const job = must(registrationJobs()[0])
      expect((job.opts as { delay?: number }).delay ?? 0).toBe(0)
    })

    it('queues a registration for the next UTC day once the cap is reached, never drops it', async () => {
      await t.redis.client.set(`relay:registrations:${today()}`, '200')
      const m = await eligible()

      await t.app.get(MerchantChainService).requestRegistration(m.id)

      const job = must(registrationJobs()[0])
      const delay = (job.opts as { delay?: number }).delay ?? 0
      const nextMidnight = Math.floor(Date.now() / 86_400_000) * 86_400_000 + 86_400_000
      expect(delay).toBeGreaterThan(0)
      expect(Math.abs(Date.now() + delay - nextMidnight)).toBeLessThan(5_000)
    })

    it("counts a merchant's registration once however often it is requested", async () => {
      const m = await eligible()
      const chain = t.app.get(MerchantChainService)

      await chain.requestRegistration(m.id)
      await chain.requestRegistration(m.id)

      expect(await t.redis.client.get(`relay:registrations:${today()}`)).toBe('1')
    })
  })

  describe('new free merchants start lower', () => {
    const ADMIN_EMAIL = 'ops@strimz.test'
    const adminToken = `test|${makePrivyDid(ADMIN_EMAIL)}|${ADMIN_EMAIL}|`
    const usedToday = (merchantId: string, submissions: number) =>
      t.prisma.db.relayDailyUsage.create({
        data: {
          merchantId,
          day: new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`),
          submissions,
        },
      })
    const unlock = (merchantId: string) =>
      t.inject({
        method: 'POST',
        url: `/v1/admin/merchants/${merchantId}/relay-unlock`,
        headers: { authorization: `Bearer ${adminToken}` },
      })

    it('relays 50 a day for a free merchant with no real payment yet', async () => {
      const m = await merchant()
      await usedToday(m.id, 50)

      const res = await pay(m.id)

      expect(res.statusCode).toBe(402)
      expect(refusal(res.body).details.reason).toBe('merchant_quota')
    })

    it('unlocks the full quota after a confirmed payment of at least 1.00', async () => {
      const m = await merchant()
      await seedTransaction(t.prisma.db, m.id, { amount: '1000000', status: 'confirmed' })
      await usedToday(m.id, 50)

      expect((await pay(m.id)).statusCode).toBe(201)
    })

    it("doesn't unlock on a payment below 1.00, a pending one or a refund", async () => {
      const m = await merchant()
      await seedTransaction(t.prisma.db, m.id, { amount: '999999', status: 'confirmed' })
      await seedTransaction(t.prisma.db, m.id, { amount: '5000000', status: 'pending' })
      await t.prisma.db.transaction.updateMany({
        where: { merchantId: m.id, status: 'pending' },
        data: { kind: 'refund', status: 'confirmed' },
      })
      await usedToday(m.id, 50)

      expect((await pay(m.id)).statusCode).toBe(402)
    })

    it('lets an admin lift a merchant early, and logs who did it', async () => {
      const admin = await t.prisma.db.adminUser.create({
        data: { email: ADMIN_EMAIL, role: 'admin', privyUserId: makePrivyDid(ADMIN_EMAIL) },
      })
      const m = await merchant()
      await usedToday(m.id, 50)

      const res = await unlock(m.id)

      expect(res.statusCode).toBe(201)
      expect((await pay(m.id)).statusCode).toBe(201)
      const log = await t.prisma.db.auditLog.findFirstOrThrow({
        where: { action: 'merchant.relay_unlocked', targetId: m.id },
      })
      expect(log.actorId).toBe(admin.id)
    })

    it("doesn't let a merchant lift itself", async () => {
      const m = await merchant()

      const res = await t.inject({
        method: 'POST',
        url: `/v1/admin/merchants/${m.id}/relay-unlock`,
        headers: { authorization: `Bearer ${m.privyAccessToken}` },
      })

      expect([401, 403]).toContain(res.statusCode)
      expect(
        (await t.prisma.db.merchant.findUniqueOrThrow({ where: { id: m.id } })).relayUnlockedAt,
      ).toBeNull()
    })
  })
})
