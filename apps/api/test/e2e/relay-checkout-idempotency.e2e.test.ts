import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { encodeErrorResult, keccak256, stringToHex, toHex } from 'viem'
import { QUEUE_NAMES, relayJobSchema } from '@strimz/queue-contracts'
import { checkoutPaymentNonce } from '@strimz/shared-crypto/checkout'

import { relayRevertAbi } from '../../src/modules/relay/relay-revert.js'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { must } from '../helpers/must.js'
import { seedApiKey, seedMerchant, seedPaymentSession } from '../helpers/fixtures.js'

const USDC = '0x3600000000000000000000000000000000000000'
const PAYER = `0x${'d'.repeat(40)}`
const AMOUNT = '100000000'

describe('relay checkout idempotency e2e', () => {
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
    t.chain.reset()
    t.redis.reset()
  })

  const relayJobs = () => t.queue.jobsFor(QUEUE_NAMES.relaySubmission)

  async function setup(status: 'awaiting_payment' | 'submitted' = 'awaiting_payment') {
    const m = await seedMerchant(t.prisma.db, { onboardingCompleted: true, onchainMerchantId: 1 })
    const k = await seedApiKey(t.prisma.db, m.id, { scopes: ['relay_write', 'relay_read'] })
    const session = await seedPaymentSession(t.prisma.db, m.id, { status, amount: AMOUNT })
    return { m, k, session }
  }

  function payment(sessionId: string, tag: string, over: Record<string, unknown> = {}) {
    return {
      merchantId: '1',
      token: USDC,
      auth: {
        from: PAYER,
        amount: AMOUNT,
        validAfter: '0',
        validBefore: String(Math.floor(Date.now() / 1000) + 300),
        nonce: checkoutPaymentNonce(sessionId),
      },
      ref: stringToHex(sessionId, { size: 32 }),
      authSignature: { v: 27, r: keccak256(toHex(`auth-r-${tag}`)), s: `0x${'2'.repeat(64)}` },
      intentSignature: { v: 27, r: keccak256(toHex(`intent-r-${tag}`)), s: `0x${'4'.repeat(64)}` },
      sessionId,
      ...over,
    }
  }

  const submit = (secretKey: string, payload: Record<string, unknown>) =>
    t.inject({
      method: 'POST',
      url: '/v1/relay/payments',
      headers: { authorization: `Bearer ${secretKey}` },
      payload,
    })

  const lookup = (secretKey: string, key: string, sessionId?: string) =>
    t.inject({
      method: 'GET',
      url: `/v1/relay/submissions/${key}${sessionId ? `?sessionId=${sessionId}` : ''}`,
      headers: { authorization: `Bearer ${secretKey}` },
    })

  it('issues a relay-pay key from the signed payload and enqueues under it', async () => {
    const { k, session } = await setup()

    const res = await submit(k.secretKey, payment(session.id, 'payer'))

    expect(res.statusCode).toBe(201)
    const view = JSON.parse(res.body)
    expect(view.idempotencyKey).toMatch(/^relay-pay-[0-9a-f]{64}$/u)
    const jobs = relayJobs()
    expect(jobs).toHaveLength(1)
    expect((must(jobs[0]).opts as { jobId: string }).jobId).toBe(view.idempotencyKey)
    expect(relayJobSchema.parse(must(jobs[0]).data).idempotencyKey).toBe(view.idempotencyKey)
    expect(t.chain.calls).toHaveLength(1)
  })

  it('ignores a client idempotencyKey equal to the session id', async () => {
    const { k, session } = await setup()

    const res = await submit(k.secretKey, {
      ...payment(session.id, 'payer'),
      idempotencyKey: session.id,
    })

    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body).idempotencyKey).not.toContain(session.id)
  })

  it('refuses a junk submission at simulation and leaves the payer free to pay', async () => {
    const { k, session } = await setup()
    t.chain.revertData = encodeErrorResult({
      abi: relayRevertAbi,
      errorName: 'Error',
      args: ['FiatTokenV2: invalid signature'],
    })

    const junk = await submit(k.secretKey, {
      ...payment(session.id, 'junk'),
      idempotencyKey: session.id,
    })

    expect(junk.statusCode).toBe(400)
    expect(JSON.parse(junk.body).error).toMatchObject({
      code: 'relay_simulation_failed',
      details: { revert: 'FiatTokenV2: invalid signature' },
    })
    expect(relayJobs()).toHaveLength(0)

    t.chain.revertData = null
    const real = await submit(k.secretKey, payment(session.id, 'payer'))
    expect(real.statusCode).toBe(201)
    expect(relayJobs()).toHaveLength(1)
  })

  it('returns the same submission for the identical signed payload', async () => {
    const { k, session } = await setup()
    const body = payment(session.id, 'payer')

    const a = JSON.parse((await submit(k.secretKey, body)).body)
    const b = JSON.parse((await submit(k.secretKey, body)).body)

    expect(b.idempotencyKey).toBe(a.idempotencyKey)
    expect(relayJobs()).toHaveLength(1)
  })

  it('409s a differently signed attempt while the first can still land', async () => {
    const { k, session } = await setup()
    const first = JSON.parse((await submit(k.secretKey, payment(session.id, 'first'))).body)

    const second = await submit(k.secretKey, payment(session.id, 'second'))

    expect(second.statusCode).toBe(409)
    expect(JSON.parse(second.body).error).toMatchObject({
      code: 'attempt_in_progress',
      details: { submission: { idempotencyKey: first.idempotencyKey } },
    })
    expect(relayJobs()).toHaveLength(1)
  })

  it('400s an authorization that does not use the session payment nonce', async () => {
    const { k, session } = await setup()
    const body = payment(session.id, 'payer')

    const res = await submit(k.secretKey, {
      ...body,
      auth: { ...body.auth, nonce: keccak256(toHex('random')) },
    })

    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error.code).toBe('auth_nonce_mismatch')
    expect(relayJobs()).toHaveLength(0)
    expect(t.chain.calls).toHaveLength(0)
  })

  it('409s a session whose payment was already mined', async () => {
    const { k, session } = await setup('submitted')

    const res = await submit(k.secretKey, payment(session.id, 'payer'))

    expect(res.statusCode).toBe(409)
    expect(JSON.parse(res.body).error.code).toBe('session_already_submitted')
    expect(relayJobs()).toHaveLength(0)
  })

  describe('GET /v1/relay/submissions/:key', () => {
    it('returns the submission to its merchant and session only', async () => {
      const { k, session } = await setup()
      const view = JSON.parse((await submit(k.secretKey, payment(session.id, 'payer'))).body)

      const own = await lookup(k.secretKey, view.idempotencyKey, session.id)
      const unscoped = await lookup(k.secretKey, view.idempotencyKey)
      const otherSession = await lookup(
        k.secretKey,
        view.idempotencyKey,
        'cmothersession0000000001',
      )

      expect(own.statusCode).toBe(200)
      expect(JSON.parse(own.body).idempotencyKey).toBe(view.idempotencyKey)
      expect(unscoped.statusCode).toBe(200)
      expect(otherSession.statusCode).toBe(404)
    })

    it("404s another merchant's submission", async () => {
      const { k, session } = await setup()
      const view = JSON.parse((await submit(k.secretKey, payment(session.id, 'payer'))).body)
      const other = await seedMerchant(t.prisma.db, { onchainMerchantId: 2 })
      const otherKey = await seedApiKey(t.prisma.db, other.id, { scopes: ['relay_read'] })

      const res = await lookup(otherKey.secretKey, view.idempotencyKey)

      expect(res.statusCode).toBe(404)
      expect(JSON.parse(res.body).error.code).toBe('submission_not_found')
    })

    it('404s a client-chosen key', async () => {
      const { k, session } = await setup()
      await submit(k.secretKey, { ...payment(session.id, 'payer'), idempotencyKey: session.id })

      const res = await lookup(k.secretKey, session.id, session.id)

      expect(res.statusCode).toBe(404)
    })
  })
})
