import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { relayCheckout, signCheckout, type RelayBody } from './flows.js'
import {
  actors,
  chain,
  db,
  deployment,
  eventually,
  merchant,
  publicPost,
  strimz,
  usdcBalance,
  type Submission,
} from './support.js'

const AMOUNT = 5_000_000n // 5 USDC
const BPS = 10_000n

describe('hosted checkout one-shot payment', () => {
  const expectedFee = (AMOUNT * BigInt(merchant.feeBps)) / BPS
  const expectedNet = AMOUNT - expectedFee
  let sessionId: string
  let body: RelayBody
  let first: Submission
  let before: { payer: bigint; payout: bigint; fees: bigint }

  const sessionEvent = () => ({
    type: 'payment_completed' as const,
    payload: { path: ['data', 'session', 'id'], equals: sessionId },
  })

  beforeAll(async () => {
    const session = await strimz.paymentSessions.create({
      amount: AMOUNT.toString(),
      currency: 'USDC',
      description: 'full-stack e2e',
    })
    sessionId = session.id
    before = {
      payer: await usdcBalance(actors.payer.address),
      payout: await usdcBalance(actors.payout.address),
      fees: await usdcBalance(deployment.feeCollector),
    }
    body = await signCheckout(sessionId, AMOUNT, 5 * 60)
    first = await relayCheckout(sessionId, body)
  })

  afterAll(async () => {
    await db().$disconnect()
  })

  it('the relayer lands the payment on-chain', async () => {
    expect(first.status).toBe('confirmed')
    if (!first.txHash) throw new Error('confirmed submission has no tx hash')
    const receipt = await chain.getTransactionReceipt({ hash: first.txHash })
    expect(receipt.status).toBe('success')
    expect(receipt.from.toLowerCase()).toBe(actors.relayer.address.toLowerCase())
  })

  it('moves exactly the amount, split into fee and net, and the payer pays no gas', async () => {
    expect(before.payer - (await usdcBalance(actors.payer.address))).toBe(AMOUNT)
    expect((await usdcBalance(actors.payout.address)) - before.payout).toBe(expectedNet)
    expect((await usdcBalance(deployment.feeCollector)) - before.fees).toBe(expectedFee)
  })

  it('the indexer confirms the session with matching amounts', async () => {
    const session = await eventually(
      'session confirmed',
      () => strimz.paymentSessions.retrieve(sessionId),
      (s) => s.status === 'confirmed',
    )
    expect(session.onchainTxHash).toBe(first.txHash)
    expect(session.feeAmount).toBe(expectedFee.toString())
    expect(session.netAmount).toBe(expectedNet.toString())
  })

  it('records exactly one transaction for the session', async () => {
    const rows = await eventually(
      'transaction row',
      () => db().transaction.findMany({ where: { sessionId } }),
      (r) => r.length > 0,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.onchainTxHash).toBe(first.txHash)
    expect(rows[0]?.status).toBe('confirmed')
  })

  it('dispatches payment.completed to the endpoint, and the loopback target is refused', async () => {
    const event = await eventually(
      'payment.completed dispatched',
      () =>
        db().webhookEvent.findFirst({
          where: { ...sessionEvent(), merchantId: merchant.id },
          include: { deliveries: true },
        }),
      (e) => e?.dispatchedAt != null && (e.deliveries[0]?.lastError ?? null) !== null,
    )
    expect(event?.deliveries).toHaveLength(1)
    expect(event?.deliveries[0]?.endpointId).toBe(merchant.webhookEndpointId)
    expect(event?.deliveries[0]?.deliveredAt).toBeNull()
    expect(event?.deliveries[0]?.lastError).toContain('resolves to blocked address 127.0.0.1')
  })

  it('an identical replay returns the same submission and broadcasts nothing', async () => {
    const replay = await publicPost(`/v1/checkout/sessions/${sessionId}/relay`, body)
    expect(replay.idempotencyKey).toBe(first.idempotencyKey)
    expect(replay.txHash).toBe(first.txHash)
  })

  it('a fresh signature for a paid session gets the original payment back and moves no money', async () => {
    const payerBefore = await usdcBalance(actors.payer.address)
    const resigned = await signCheckout(sessionId, AMOUNT, 10 * 60)
    expect(resigned.authSignature).not.toBe(body.authSignature)
    const answer = await publicPost(`/v1/checkout/sessions/${sessionId}/relay`, resigned)
    expect(answer.status).toBe('confirmed')
    expect(answer.txHash).toBe(first.txHash)
    expect(await usdcBalance(actors.payer.address)).toBe(payerBefore)
    expect(await db().transaction.count({ where: { sessionId } })).toBe(1)
    expect(await db().webhookEvent.count({ where: sessionEvent() })).toBe(1)
  })
})
