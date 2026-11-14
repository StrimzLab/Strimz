import { arcTestnet } from '@strimz/shared-config'
import { createWalletClient, http, parseAbi, parseEventLogs, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { payer, signEnrolment } from './flows.js'
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
  type Submission,
} from './support.js'

const AMOUNT = 2_000_000n // 2 USDC
const BPS = 10_000n
const DUPLICATE_OUTCOME = 7 // ChargeOutcome.Duplicate in IStrimzSubscriptions
const bytes32Schema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/u)
  .transform((h) => h as Hex)

const subscriptionsAbi = parseAbi([
  'struct Subscription { address payer; uint64 nextChargeAt; uint32 interval; address token; uint96 merchantId; uint256 amount; uint64 endAt; bool cancelled; }',
  'function getSubscription(uint256 subscriptionId) view returns (Subscription)',
  'function isAttemptUsed(bytes32 chargeAttemptId) view returns (bool)',
  'function batchCharge(uint256[] subscriptionIds, bytes32[] chargeAttemptIds) returns (uint8[])',
  'event SubscriptionChargeSkipped(uint256 indexed subscriptionId, bytes32 indexed chargeAttemptId, uint8 outcome)',
])

function onChain(id: number) {
  return chain.readContract({
    address: deployment.subscriptions,
    abi: subscriptionsAbi,
    functionName: 'getSubscription',
    args: [BigInt(id)],
  })
}

describe('hosted checkout subscription', () => {
  const expectedFee = (AMOUNT * BigInt(merchant.feeBps)) / BPS
  let planId: string
  let enrolment: Submission
  let subscriptionId: string
  let onchainId: number
  let before: { payer: bigint; payout: bigint; fees: bigint }

  beforeAll(async () => {
    const plan = await strimz.subscriptionPlans.create({
      name: 'Full stack monthly',
      amount: AMOUNT.toString(),
      currency: 'USDC',
      interval: 'monthly',
    })
    planId = plan.id
    before = {
      payer: await usdcBalance(actors.payer.address),
      payout: await usdcBalance(actors.payout.address),
      fees: await usdcBalance(deployment.feeCollector),
    }
    const body = await signEnrolment(planId, AMOUNT, plan.intervalSeconds)
    enrolment = await publicPost(`/v1/checkout/plans/${planId}/relay`, body)
    if (!TERMINAL.has(enrolment.status)) {
      const key = enrolment.idempotencyKey
      enrolment = await eventually(
        'enrolment submission',
        () => publicGet(`/v1/checkout/plans/${planId}/submissions/${key}`, submissionSchema),
        (s) => TERMINAL.has(s.status),
      )
    }
  })

  afterAll(async () => {
    await db().$disconnect()
  })

  it('the relayer lands the enrolment on-chain', () => {
    expect(enrolment.status).toBe('confirmed')
    expect(enrolment.txHash).not.toBeNull()
  })

  it('the indexer projects the subscription onto the plan', async () => {
    const sub = await eventually(
      'subscription row',
      () => db().subscription.findFirst({ where: { planId } }),
      (s) => s?.onchainSubscriptionId != null,
    )
    if (!sub?.onchainSubscriptionId) throw new Error('subscription has no on-chain id')
    subscriptionId = sub.id
    onchainId = sub.onchainSubscriptionId
    expect(sub.payerAddress.toLowerCase()).toBe(payer.address.toLowerCase())
    const s = await onChain(onchainId)
    expect(s.payer.toLowerCase()).toBe(payer.address.toLowerCase())
    expect(s.amount).toBe(AMOUNT)
  })

  it('the scheduler charges the first period and the indexer records it', async () => {
    const charge = await eventually(
      'first charge succeeded',
      () => db().subscriptionCharge.findFirst({ where: { subscriptionId } }),
      (c) => c?.status === 'succeeded',
      90_000,
    )
    const receipt = await chain.getTransactionReceipt({
      hash: bytes32Schema.parse(charge?.onchainTxHash),
    })
    expect(receipt.from.toLowerCase()).toBe(actors.scheduler.address.toLowerCase())
    expect(charge?.amount).toBe(AMOUNT.toString())
    expect(before.payer - (await usdcBalance(actors.payer.address))).toBe(AMOUNT)
    expect((await usdcBalance(actors.payout.address)) - before.payout).toBe(AMOUNT - expectedFee)
    expect((await usdcBalance(deployment.feeCollector)) - before.fees).toBe(expectedFee)
  })

  it('subscription.created and subscription.charged reach the endpoint', async () => {
    for (const type of ['subscription_created', 'subscription_charged'] as const) {
      const event = await eventually(
        `${type} dispatched`,
        () =>
          db().webhookEvent.findFirst({
            where: { merchantId: merchant.id, type },
            include: { deliveries: true },
          }),
        (e) => e?.dispatchedAt != null && e.deliveries.length === 1,
      )
      expect(event?.deliveries[0]?.endpointId).toBe(merchant.webhookEndpointId)
    }
  })

  it('replaying the same charge is rejected on-chain and moves no money', async () => {
    const charge = await db().subscriptionCharge.findFirstOrThrow({ where: { subscriptionId } })
    const attemptId = bytes32Schema.parse(charge.chargeAttemptId)
    expect(
      await chain.readContract({
        address: deployment.subscriptions,
        abi: subscriptionsAbi,
        functionName: 'isAttemptUsed',
        args: [attemptId],
      }),
    ).toBe(true)

    const before = await usdcBalance(actors.payer.address)
    const scheduler = createWalletClient({
      account: privateKeyToAccount(actors.scheduler.privateKey),
      chain: arcTestnet,
      transport: http(deployment.rpcUrl),
    })
    const hash = await scheduler.writeContract({
      address: deployment.subscriptions,
      abi: subscriptionsAbi,
      functionName: 'batchCharge',
      args: [[BigInt(onchainId)], [attemptId]],
    })
    const receipt = await chain.waitForTransactionReceipt({ hash })
    const skipped = parseEventLogs({
      abi: subscriptionsAbi,
      eventName: 'SubscriptionChargeSkipped',
      logs: receipt.logs,
    })
    expect(skipped).toHaveLength(1)
    expect(skipped[0]?.args.outcome).toBe(DUPLICATE_OUTCOME)
    expect(await usdcBalance(actors.payer.address)).toBe(before)
    expect(
      await db().subscriptionCharge.count({ where: { subscriptionId, status: 'succeeded' } }),
    ).toBe(1)
  })

  it('a merchant cancel through the SDK lands on-chain and sends subscription.cancelled', async () => {
    await strimz.subscriptions.cancel({ id: subscriptionId, reason: 'full-stack e2e' })
    await eventually(
      'on-chain cancel',
      () => onChain(onchainId),
      (s) => s.cancelled,
      90_000,
    )
    const event = await eventually(
      'subscription.cancelled dispatched',
      () =>
        db().webhookEvent.findFirst({
          where: { merchantId: merchant.id, type: 'subscription_cancelled' },
          include: { deliveries: true },
        }),
      (e) => e?.dispatchedAt != null && e.deliveries.length === 1,
    )
    expect(event?.deliveries[0]?.endpointId).toBe(merchant.webhookEndpointId)
  })
})
