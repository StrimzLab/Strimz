import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { decodeFunctionData } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { QUEUE_NAMES, relayJobSchema } from '@strimz/queue-contracts'
import {
  buildCancelSubscriptionTypedData,
  buildViewSubscriptionsTypedData,
} from '@strimz/sdk/eip712'

import { cancelWithSigAbi } from '../../src/modules/relay/generated/contracts.js'
import { createTestApp, type TestApp } from '../helpers/test-app.factory.js'
import { truncateAll } from '../helpers/db-helper.js'
import { must } from '../helpers/must.js'
import { seedMerchant, seedSubscription } from '../helpers/fixtures.js'

const CHAIN_ID = 5042002
const SUBSCRIPTIONS = '0x0000000000000000000000000000000000000a03'

// ADR-2026-11-20-subscriber-self-cancel (#499).
describe('subscriber manages their subscriptions', () => {
  let t: TestApp
  let ip = 0
  let remoteAddress = '203.0.113.1'
  const payer = privateKeyToAccount(generatePrivateKey())
  const stranger = privateKeyToAccount(generatePrivateKey())

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
    remoteAddress = `203.0.113.${ip}`
  })

  let onchainId = 100
  async function subscription(
    owner: `0x${string}`,
    status: 'active' | 'at_risk' | 'trialing' | 'cancelled' = 'active',
  ) {
    onchainId += 1
    const m = await seedMerchant(t.prisma.db, {
      onboardingCompleted: true,
      onchainMerchantId: onchainId,
    })
    return seedSubscription(t.prisma.db, m.id, {
      payerAddress: owner.toLowerCase(),
      status,
      onchainSubscriptionId: onchainId,
    })
  }

  const nowSec = () => BigInt(Math.floor(Date.now() / 1000))

  async function signView(signer = payer, issuedAt = nowSec(), as = payer.address) {
    const typed = buildViewSubscriptionsTypedData({ chainId: CHAIN_ID, payer: as, issuedAt })
    const signature = await signer.signTypedData({
      domain: typed.domain,
      types: typed.types,
      primaryType: 'ViewSubscriptions',
      message: { payer: as, issuedAt },
    })
    return { payer: as, issuedAt: issuedAt.toString(), signature }
  }

  async function signCancel(onchainSubscriptionId: number, signer = payer) {
    const deadline = nowSec() + 1800n
    const typed = buildCancelSubscriptionTypedData({
      chainId: CHAIN_ID,
      verifyingContract: SUBSCRIPTIONS,
      subscriptionId: BigInt(onchainSubscriptionId),
      deadline,
    })
    const signature = await signer.signTypedData({
      domain: typed.domain,
      types: typed.types,
      primaryType: 'CancelSubscription',
      message: { subscriptionId: BigInt(onchainSubscriptionId), deadline },
    })
    return { deadline: deadline.toString(), signature }
  }

  const list = (payload: Record<string, string>) =>
    t.inject({ method: 'POST', url: '/v1/checkout/manage/subscriptions', remoteAddress, payload })
  const cancel = (id: string, payload: Record<string, string>) =>
    t.inject({
      method: 'POST',
      url: `/v1/checkout/manage/subscriptions/${id}/cancel`,
      remoteAddress,
      payload,
    })
  const relayJobs = () =>
    t.queue.jobsFor(QUEUE_NAMES.relaySubmission).map((j) => relayJobSchema.parse(j.data))

  it("lists only the signer's open subscriptions", async () => {
    const mine = await subscription(payer.address)
    await subscription(payer.address, 'cancelled')
    await subscription(stranger.address)

    const res = await list(await signView())

    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body) as {
      chainId: number
      subscriptionsAddress: string
      data: { subscriptionId: string; onchainSubscriptionId: number }[]
    }
    expect(body.chainId).toBe(CHAIN_ID)
    expect(body.subscriptionsAddress).toBe(SUBSCRIPTIONS)
    expect(body.data.map((s) => s.subscriptionId)).toEqual([mine.id])
  })

  it("refuses to list a wallet the signer doesn't own", async () => {
    await subscription(payer.address)

    const res = await list(await signView(stranger, nowSec(), payer.address))

    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body)).toMatchObject({ error: { code: 'invalid_signature' } })
  })

  it('refuses a sign-in older than ten minutes', async () => {
    const res = await list(await signView(payer, nowSec() - 601n))

    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body)).toMatchObject({ error: { code: 'signature_expired' } })
  })

  it("relays the payer's signed cancel and leaves the row to the indexer", async () => {
    const sub = await subscription(payer.address)
    const signed = await signCancel(must(sub.onchainSubscriptionId))

    const res = await cancel(sub.id, signed)

    expect(res.statusCode).toBe(201)
    const job = must(relayJobs()[0])
    if (job.reason !== 'cancelWithSig') throw new Error(`expected cancelWithSig, got ${job.reason}`)
    expect(job.toAddress).toBe(SUBSCRIPTIONS)
    const decoded = decodeFunctionData({ abi: cancelWithSigAbi, data: job.callData })
    expect(decoded.args).toEqual([
      BigInt(must(sub.onchainSubscriptionId)),
      BigInt(signed.deadline),
      signed.signature,
    ])
    const row = await t.prisma.db.subscription.findUniqueOrThrow({ where: { id: sub.id } })
    expect(row.status).toBe('active')
  })

  it('refuses a cancel signed by someone other than the payer', async () => {
    const sub = await subscription(payer.address)

    const res = await cancel(sub.id, await signCancel(must(sub.onchainSubscriptionId), stranger))

    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body)).toMatchObject({ error: { code: 'invalid_signature' } })
    expect(relayJobs()).toHaveLength(0)
  })

  it('refuses to cancel a subscription that is already cancelled', async () => {
    const sub = await subscription(payer.address, 'cancelled')

    const res = await cancel(sub.id, await signCancel(must(sub.onchainSubscriptionId)))

    expect(res.statusCode).toBe(409)
    expect(relayJobs()).toHaveLength(0)
  })
})
