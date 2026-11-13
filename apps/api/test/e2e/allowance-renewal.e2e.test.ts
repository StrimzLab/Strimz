import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { decodeFunctionData, parseAbi } from 'viem'
import { QUEUE_NAMES, relayJobSchema } from '@strimz/queue-contracts'
import { getTokenAddress } from '@strimz/shared-config'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { must } from '../helpers/must.js'
import { seedMerchant, seedSubscription } from '../helpers/fixtures.js'

const PAYER = `0x${'c'.repeat(40)}`
const SUBSCRIPTIONS = '0x0000000000000000000000000000000000000a03'
const USDC = getTokenAddress('testnet', 'USDC').toLowerCase()
const permitAbi = parseAbi([
  'function permit(address owner, address spender, uint256 value, uint256 deadline, bytes signature)',
])

// ADR-2026-11-13-capped-subscription-allowance: a payer renews their capped approval.
describe('subscription allowance renewal', () => {
  let t: TestApp
  let ip = 0
  let remoteAddress = '198.51.100.1'

  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await truncateAll(t.prisma.db)
    t.queue.reset()
    t.redis.reset()
    ip += 1
    remoteAddress = `198.51.100.${ip}`
  })

  let onchainId = 0
  async function subscription(status: 'active' | 'at_risk' | 'trialing' | 'cancelled' = 'active') {
    onchainId += 1
    const m = await seedMerchant(t.prisma.db, {
      onboardingCompleted: true,
      onchainMerchantId: onchainId,
    })
    return seedSubscription(t.prisma.db, m.id, { payerAddress: PAYER, status })
  }

  const renewal = (id: string) =>
    t.inject({ method: 'GET', url: `/v1/checkout/subscriptions/${id}/renewal`, remoteAddress })

  const renew = (id: string, body: Partial<Record<string, string>> = {}) =>
    t.inject({
      method: 'POST',
      url: `/v1/checkout/subscriptions/${id}/allowance`,
      remoteAddress,
      payload: {
        owner: PAYER,
        value: (20_000_000n * 12n).toString(),
        deadline: String(Math.floor(Date.now() / 1000) + 3600),
        signature: `0x${'ab'.repeat(65)}`,
        ...body,
      },
    })

  const relayJobs = () =>
    t.queue.jobsFor(QUEUE_NAMES.relaySubmission).map((j) => relayJobSchema.parse(j.data))

  it('describes the subscription for the renewal page', async () => {
    const sub = await subscription()

    const res = await renewal(sub.id)

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toMatchObject({
      subscriptionId: sub.id,
      status: 'active',
      amount: '20000000',
      currency: 'USDC',
      token: USDC,
      payerAddress: PAYER,
      spender: SUBSCRIPTIONS,
      suggestedAllowance: (20_000_000n * 12n).toString(),
    })
    expect((await renewal('sub_missing')).statusCode).toBe(404)
  })

  it('relays a token permit from the payer to the Subscriptions contract', async () => {
    const sub = await subscription('at_risk')

    const res = await renew(sub.id)

    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body)).toMatchObject({ status: 'queued', reason: 'permitAllowance' })
    const job = must(relayJobs()[0])
    expect(job.reason).toBe('permitAllowance')
    if (job.reason !== 'permitAllowance') return
    expect(job.toAddress.toLowerCase()).toBe(USDC)
    expect(job.subscriptionInternalId).toBe(sub.id)
    const call = decodeFunctionData({ abi: permitAbi, data: job.callData })
    expect(call.args[0].toLowerCase()).toBe(PAYER)
    expect(call.args[1].toLowerCase()).toBe(SUBSCRIPTIONS)
    expect(call.args[2]).toBe(20_000_000n * 12n)
  })

  it.each([
    ['a wallet that is not the payer', { owner: `0x${'d'.repeat(40)}` }, 403, 'payer_mismatch'],
    ['an allowance below one charge', { value: '19999999' }, 400, 'invalid_request'],
  ])('refuses %s', async (_, body, status, code) => {
    const sub = await subscription()

    const res = await renew(sub.id, body)

    expect(res.statusCode).toBe(status)
    expect(JSON.parse(res.body).error.code).toBe(code)
    expect(relayJobs()).toHaveLength(0)
  })

  it('refuses a cancelled subscription', async () => {
    const sub = await subscription('cancelled')

    const res = await renew(sub.id)

    expect(res.statusCode).toBe(409)
    expect(JSON.parse(res.body).error.code).toBe('subscription_not_active')
    expect(relayJobs()).toHaveLength(0)
  })

  it('reports the submission to its own subscription only', async () => {
    const sub = await subscription()
    const other = await subscription()
    const { idempotencyKey } = JSON.parse((await renew(sub.id)).body) as { idempotencyKey: string }

    const own = await t.inject({
      method: 'GET',
      url: `/v1/checkout/subscriptions/${sub.id}/submissions/${idempotencyKey}`,
      remoteAddress,
    })
    const foreign = await t.inject({
      method: 'GET',
      url: `/v1/checkout/subscriptions/${other.id}/submissions/${idempotencyKey}`,
      remoteAddress,
    })

    expect(own.statusCode).toBe(200)
    expect(foreign.statusCode).toBe(404)
  })
})
