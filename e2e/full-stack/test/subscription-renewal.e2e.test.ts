import { createTestClient, http, parseAbi } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fundUsdc } from '../src/chain.js'
import { signEnrolment, type Signer } from './flows.js'
import {
  actors,
  chain,
  db,
  deployment,
  eventually,
  merchant,
  publicGet,
  publicPost,
  strimz,
  submissionSchema,
  TERMINAL,
  usdcBalance,
} from './support.js'

// Not the 2 USDC of the checkout suite: the indexer files a signup under the first
// plan with the same price and interval (#497).
const AMOUNT = 3_000_000n // 3 USDC
const MONTH = 30 * 24 * 60 * 60
const BPS = 10_000n
// What checkout approves for an open-ended plan (OPEN_ENDED_CHARGES).
const CAPPED_ALLOWANCE = AMOUNT * 12n

const subscriptionsAbi = parseAbi([
  'struct Subscription { address payer; uint64 nextChargeAt; uint32 interval; address token; uint96 merchantId; uint256 amount; uint64 endAt; bool cancelled; }',
  'function getSubscription(uint256 subscriptionId) view returns (Subscription)',
])

const anvil = createTestClient({ mode: 'anvil', transport: http(deployment.rpcUrl) })

// The scheduler picks due rows by wall-clock time while the contract uses block
// time. Running the chain a month behind lets a 30-day warp make the renewal due
// for both without faking the services' clocks.
async function setChainTime(unixSeconds: number): Promise<void> {
  const res = await fetch(deployment.rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'anvil_setTime', params: [unixSeconds] }),
  })
  if (!res.ok) throw new Error(`anvil_setTime failed: ${res.status}`)
  await anvil.mine({ blocks: 1 })
}

function onChain(id: number) {
  return chain.readContract({
    address: deployment.subscriptions,
    abi: subscriptionsAbi,
    functionName: 'getSubscription',
    args: [BigInt(id)],
  })
}

const subscriber = privateKeyToAccount(generatePrivateKey())
const signer: Signer = { account: subscriber, onchainMerchantId: merchant.onchainMerchantId }

describe('monthly subscription renewal', () => {
  const fee = (AMOUNT * BigInt(merchant.feeBps)) / BPS
  let planId: string
  let subscriptionId: string
  let onchainId: number
  let firstChargeAt: bigint

  beforeAll(async () => {
    await setChainTime(Math.floor(Date.now() / 1000) - MONTH - 24 * 60 * 60)
    // Exactly one month's price, so the renewal finds the wallet empty.
    await fundUsdc(deployment.rpcUrl, subscriber.address, AMOUNT / 1_000_000n)

    const plan = await strimz.subscriptionPlans.create({
      name: 'Renewal monthly',
      amount: AMOUNT.toString(),
      currency: 'USDC',
      interval: 'monthly',
    })
    planId = plan.id
    const body = await signEnrolment(planId, AMOUNT, plan.intervalSeconds, signer, CAPPED_ALLOWANCE)
    let enrolment = await publicPost(`/v1/checkout/plans/${planId}/relay`, body)
    if (!TERMINAL.has(enrolment.status)) {
      const key = enrolment.idempotencyKey
      enrolment = await eventually(
        'enrolment submission',
        () => publicGet(`/v1/checkout/plans/${planId}/submissions/${key}`, submissionSchema),
        (s) => TERMINAL.has(s.status),
      )
    }
    expect(enrolment.status).toBe('confirmed')
  })

  afterAll(async () => {
    await setChainTime(Math.floor(Date.now() / 1000))
    await db().$disconnect()
  })

  it('charges the first month and books the next charge 30 days out', async () => {
    const sub = await eventually(
      'first period paid',
      () => db().subscription.findFirst({ where: { planId } }),
      (s) => s?.onchainSubscriptionId != null && s.status === 'active' && s.retryCount === 0,
      90_000,
    )
    if (sub?.onchainSubscriptionId == null) throw new Error('subscription was not projected')
    subscriptionId = sub.id
    onchainId = sub.onchainSubscriptionId

    const charge = await eventually(
      'first charge',
      () => db().subscriptionCharge.findFirst({ where: { subscriptionId, status: 'succeeded' } }),
      (c) => c != null,
      90_000,
    )
    expect(charge?.amount).toBe(AMOUNT.toString())
    expect(await usdcBalance(subscriber.address)).toBe(0n)

    const s = await onChain(onchainId)
    firstChargeAt = s.nextChargeAt - BigInt(MONTH)
    const row = await db().subscription.findUniqueOrThrow({ where: { id: subscriptionId } })
    expect(BigInt((row.nextChargeAt?.getTime() ?? 0) / 1000)).toBe(s.nextChargeAt)
    expect(BigInt(row.currentPeriodEndAt.getTime() / 1000)).toBe(s.nextChargeAt)
  })

  it('a month later, an empty wallet puts the subscription at risk without moving money', async () => {
    const payoutBefore = await usdcBalance(actors.payout.address)
    await anvil.increaseTime({ seconds: MONTH })
    await anvil.mine({ blocks: 1 })

    const sub = await eventually(
      'renewal failed',
      () => db().subscription.findUniqueOrThrow({ where: { id: subscriptionId } }),
      (s) => s.status === 'at_risk',
      90_000,
    )
    expect(sub.retryCount).toBeGreaterThanOrEqual(1)
    const failed = await db().subscriptionCharge.findFirst({
      where: { subscriptionId, status: 'failed' },
    })
    expect(failed?.outcome).toBe('insufficient_funds')
    expect(await usdcBalance(actors.payout.address)).toBe(payoutBefore)
    expect((await onChain(onchainId)).nextChargeAt).toBe(firstChargeAt + BigInt(MONTH))

    const event = await eventually(
      'subscription.charge_failed dispatched',
      () =>
        db().webhookEvent.findFirst({
          where: { merchantId: merchant.id, type: 'subscription_charge_failed' },
          include: { deliveries: true },
        }),
      (e) => e?.dispatchedAt != null && e.deliveries.length === 1,
    )
    expect(event?.deliveries[0]?.endpointId).toBe(merchant.webhookEndpointId)
  })

  it('topping up the wallet renews it on the next retry and opens month two', async () => {
    const payoutBefore = await usdcBalance(actors.payout.address)
    await fundUsdc(deployment.rpcUrl, subscriber.address, AMOUNT / 1_000_000n)

    const sub = await eventually(
      'renewal charged',
      () => db().subscription.findUniqueOrThrow({ where: { id: subscriptionId } }),
      (s) => s.status === 'active' && s.retryCount === 0,
      120_000,
    )
    const charges = await db().subscriptionCharge.findMany({
      where: { subscriptionId, status: 'succeeded' },
      orderBy: { executedAt: 'asc' },
    })
    expect(charges).toHaveLength(2)
    expect(charges[0]?.chargeAttemptId).not.toBe(charges[1]?.chargeAttemptId)
    expect((await usdcBalance(actors.payout.address)) - payoutBefore).toBe(AMOUNT - fee)
    expect(await usdcBalance(subscriber.address)).toBe(0n)

    const secondPeriodStart = firstChargeAt + BigInt(MONTH)
    const nextCharge = secondPeriodStart + BigInt(MONTH)
    expect((await onChain(onchainId)).nextChargeAt).toBe(nextCharge)
    expect(sub.nextRetryAt).toBeNull()
    expect(BigInt(sub.currentPeriodStartAt.getTime() / 1000)).toBe(secondPeriodStart)
    expect(BigInt(sub.currentPeriodEndAt.getTime() / 1000)).toBe(nextCharge)

    const viaSdk = await strimz.subscriptions.retrieve(subscriptionId)
    expect(viaSdk.status).toBe('active')
    expect(Date.parse(viaSdk.currentPeriodEndAt) / 1000).toBe(Number(nextCharge))
    expect(Date.parse(viaSdk.nextChargeAt ?? '') / 1000).toBe(Number(nextCharge))
    const attempts = await strimz.subscriptions.charges(subscriptionId)
    expect(attempts.data.filter((c) => c.status === 'succeeded')).toHaveLength(2)
  })
})
