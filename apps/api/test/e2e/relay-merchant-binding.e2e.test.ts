import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { keccak256, stringToHex, toHex } from 'viem'
import { QUEUE_NAMES, relayJobSchema } from '@strimz/queue-contracts'
import { checkoutPaymentNonce } from '@strimz/shared-crypto/checkout'

import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { seedApiKey, seedMerchant, seedPaymentSession } from '../helpers/fixtures.js'

const USDC = '0x3600000000000000000000000000000000000000'
const PAYER = `0x${'d'.repeat(40)}`
const ATTACKER = `0x${'a'.repeat(40)}`
const AMOUNT = '100000000'
const MONTH_SECONDS = 30 * 86_400

describe('relay merchant binding e2e', () => {
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

  const errorCode = (body: string) => (JSON.parse(body) as { error: { code: string } }).error.code

  describe('merchant API key relay', () => {
    it("refuses a self-signed payment to another merchant's on-chain id", async () => {
      const { keyA } = await merchants()

      const res = await merchantRelay(
        keyA.secretKey,
        'payments',
        payment({ merchantId: '2', amount: '1', from: ATTACKER, tag: 'drain' }),
      )

      expect(res.statusCode).toBe(403)
      expect(errorCode(res.body)).toBe('merchant_mismatch')
      expect(relayJobs()).toHaveLength(0)
      expect(t.chain.calls).toHaveLength(0)
    })

    it('requires a sessionId on a payment', async () => {
      const { keyA } = await merchants()

      const res = await merchantRelay(keyA.secretKey, 'payments', payment({ merchantId: '1' }))

      expect(res.statusCode).toBe(400)
      expect(errorCode(res.body)).toBe('invalid_request')
      expect(relayJobs()).toHaveLength(0)
    })

    it("refuses a payment for another merchant's session", async () => {
      const { b, keyA } = await merchants()
      const session = await seedPaymentSession(t.prisma.db, b.id, {
        status: 'awaiting_payment',
        amount: AMOUNT,
      })

      const res = await merchantRelay(
        keyA.secretKey,
        'payments',
        payment({ merchantId: '2', sessionId: session.id }),
      )

      expect(res.statusCode).toBe(403)
      expect(errorCode(res.body)).toBe('merchant_mismatch')
      expect(relayJobs()).toHaveLength(0)
    })

    it('requires a subscriptionInternalId on an enrolment', async () => {
      const { keyA } = await merchants()

      const res = await merchantRelay(
        keyA.secretKey,
        'subscriptions',
        enrolment({ merchantId: '1' }),
      )

      expect(res.statusCode).toBe(400)
      expect(errorCode(res.body)).toBe('invalid_request')
      expect(relayJobs()).toHaveLength(0)
    })
  })
})
