import { StrimzClient } from '@strimz/sdk'
import { afterAll, describe, expect, inject, it } from 'vitest'
import { z } from 'zod'
import type { SeededMerchant } from '../src/seed.js'
import { signCheckout, signEnrolment } from '../test/flows.js'
import { actors, apiUrl, chain, db, deployment, eventually, usdcBalance } from '../test/support.js'
import {
  at,
  counters,
  intEnv,
  merchantRelay,
  payers,
  percentile,
  signerFor,
  sleep,
  submission,
} from './load.js'

const BPS = 10_000n
const txHash = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/u)
  .transform((h) => h as `0x${string}`)
const PAYMENTS = intEnv('STRESS_PAYMENTS', 150, 1_000)
const PAYERS = intEnv('STRESS_PAYERS', 10, 100)
const RACE_ATTEMPTS = intEnv('STRESS_RACE_ATTEMPTS', 25, 55)
// The permit-nonce endpoint allows 30 calls an hour per IP, one per enrolment.
const SUBSCRIPTIONS = intEnv('STRESS_SUBSCRIPTIONS', 25, 29)
const REFUND_ATTEMPTS = intEnv('STRESS_REFUND_ATTEMPTS', 10, 50)

const merchants = inject('merchants')
const client = (m: SeededMerchant) => new StrimzClient({ apiKey: m.secretKey, baseUrl: apiUrl })
const fee = (amount: bigint, m: SeededMerchant) => (amount * BigInt(m.feeBps)) / BPS

const report: string[] = []
const note = (line: string) => report.push(line)

afterAll(async () => {
  note(
    `429s waited out: ${counters.rateLimited} (${counters.rateLimitedWithoutRetryAfter} without Retry-After)`,
  )
  process.stdout.write(`\n=== stress report ===\n${report.join('\n')}\n\n`)
  await db().$disconnect()
})

describe('stress: money paths under concurrency', () => {
  it('has a merchant for the race that the bulk load never touches', () => {
    expect(merchants.length, 'run with E2E_MERCHANTS=6').toBeGreaterThanOrEqual(6)
  })

  const bulk = merchants.slice(0, 5)
  const raceMerchant = merchants[5]
  const paidSessions: Array<{ sessionId: string; merchant: SeededMerchant; amount: bigint }> = []

  it(`S1: ${PAYMENTS} payments from ${PAYERS} payers to ${bulk.length} merchants, all at once`, async () => {
    const pool = await payers(PAYERS, 10_000n)
    const plan = Array.from({ length: PAYMENTS }, (_, i) => ({
      merchant: at(bulk, i % bulk.length),
      payer: at(pool, i % pool.length),
      // Odd amounts so a rounding slip shows up in the totals.
      amount: 1_000_000n + BigInt(i) * 1_237n,
    }))

    const sessions = await Promise.all(
      plan.map((p) =>
        client(p.merchant).paymentSessions.create({
          amount: p.amount.toString(),
          currency: 'USDC',
          description: 'stress',
        }),
      ),
    )
    const bodies = await Promise.all(
      plan.map((p, i) =>
        signCheckout(at(sessions, i).id, p.amount, 10 * 60, signerFor(p.payer, p.merchant)),
      ),
    )

    const before = {
      payout: await usdcBalance(actors.payout.address),
      fees: await usdcBalance(deployment.feeCollector),
      payers: await Promise.all(pool.map((p) => usdcBalance(p.address))),
    }

    const started = Date.now()
    const outcomes = await Promise.all(
      plan.map((p, i) =>
        merchantRelay(p.merchant, '/v1/relay/payments', {
          ...at(bodies, i),
          sessionId: at(sessions, i).id,
        }),
      ),
    )
    const refused = outcomes.filter((o) => !o.ok)
    expect(refused, JSON.stringify(refused.slice(0, 3))).toHaveLength(0)
    const accepted = Date.now() - started

    const ids = sessions.map((s) => s.id)
    const confirmedAt = new Map<string, number>()
    await eventually(
      `${PAYMENTS} sessions confirmed by the indexer`,
      async () => {
        const rows = await db().paymentSession.findMany({
          where: { id: { in: ids }, status: 'confirmed' },
          select: { id: true },
        })
        for (const r of rows)
          if (!confirmedAt.has(r.id)) confirmedAt.set(r.id, Date.now() - started)
        return rows.length
      },
      (n) => n === PAYMENTS,
      // The relayer sends one transaction at a time, so the wait grows with the load.
      Math.max(300_000, PAYMENTS * 2_000),
    )

    const txRows = await db().transaction.findMany({ where: { sessionId: { in: ids } } })
    expect(txRows).toHaveLength(PAYMENTS)
    expect(new Set(txRows.map((t) => t.sessionId)).size).toBe(PAYMENTS)
    expect(new Set(txRows.map((t) => t.onchainTxHash)).size).toBe(PAYMENTS)

    const receipts = await Promise.all(
      txRows.map((t) => chain.getTransactionReceipt({ hash: txHash.parse(t.onchainTxHash) })),
    )
    expect(receipts.filter((r) => r.status !== 'success')).toHaveLength(0)

    const totalAmount = plan.reduce((a, p) => a + p.amount, 0n)
    const totalFees = plan.reduce((a, p) => a + fee(p.amount, p.merchant), 0n)
    expect((await usdcBalance(deployment.feeCollector)) - before.fees).toBe(totalFees)
    expect((await usdcBalance(actors.payout.address)) - before.payout).toBe(totalAmount - totalFees)
    for (const [i, p] of pool.entries()) {
      const owed = plan.filter((x) => x.payer === p).reduce((a, x) => a + x.amount, 0n)
      expect(at(before.payers, i) - (await usdcBalance(p.address))).toBe(owed)
    }

    const isOurs = (payload: unknown) => {
      const id = sessionIdOf(payload)
      return id !== null && ids.includes(id)
    }
    const events = await eventually(
      'one dispatched payment.completed per session',
      () =>
        db().webhookEvent.findMany({
          where: { type: 'payment_completed', dispatchedAt: { not: null } },
          include: { deliveries: true },
        }),
      (evs) => evs.filter((e) => isOurs(e.payload)).length === PAYMENTS,
      120_000,
    )
    const ours = events.filter((e) => isOurs(e.payload))
    expect(new Set(ours.map((e) => sessionIdOf(e.payload))).size).toBe(PAYMENTS)
    expect(ours.every((e) => e.deliveries.length === 1)).toBe(true)

    plan.forEach((p, i) =>
      paidSessions.push({ sessionId: at(ids, i), merchant: p.merchant, amount: p.amount }),
    )
    const latencies = [...confirmedAt.values()]
    note(
      `S1 ${PAYMENTS} payments: all accepted in ${accepted} ms; ` +
        `confirmed and indexed p50 ${percentile(latencies, 50)} ms, ` +
        `p95 ${percentile(latencies, 95)} ms, max ${Math.max(...latencies)} ms; ` +
        `reverted txs 0; totals exact to the base unit`,
    )
  })

  it(`S2: ${RACE_ATTEMPTS} differently signed payments for one session, all at once`, async () => {
    if (!raceMerchant) throw new Error('run with E2E_MERCHANTS=6')
    const [racer] = await payers(1, 100n)
    if (!racer) throw new Error('no payer for the race')
    const amount = 4_000_000n
    const session = await client(raceMerchant).paymentSessions.create({
      amount: amount.toString(),
      currency: 'USDC',
      description: 'stress race',
    })
    const bodies = await Promise.all(
      Array.from({ length: RACE_ATTEMPTS }, (_, i) =>
        signCheckout(session.id, amount, 10 * 60 + i, signerFor(racer, raceMerchant)),
      ),
    )
    const before = await usdcBalance(racer.address)

    const outcomes = await Promise.all(
      bodies.map((b) =>
        merchantRelay(raceMerchant, '/v1/relay/payments', { ...b, sessionId: session.id }),
      ),
    )
    const accepted = outcomes.flatMap((o) => (o.ok ? [o.submission] : []))
    const finals = await Promise.all(
      [...new Set(accepted.map((s) => s.idempotencyKey))].map((key) =>
        eventually(
          `race submission ${key}`,
          () => submission(raceMerchant, key),
          (s) => ['confirmed', 'reverted', 'failed'].includes(s.status),
          120_000,
        ),
      ),
    )
    const confirmedHashes = new Set(
      finals.filter((s) => s.status === 'confirmed').map((s) => s.txHash),
    )
    const reverted = finals.filter((s) => s.status === 'reverted').length

    await eventually(
      'race session confirmed',
      () => db().paymentSession.findUniqueOrThrow({ where: { id: session.id } }),
      (s) => s.status === 'confirmed',
    )
    expect(before - (await usdcBalance(racer.address))).toBe(amount)
    expect(await db().transaction.count({ where: { sessionId: session.id } })).toBe(1)
    expect(confirmedHashes.size).toBe(1)

    const codes = outcomes.flatMap((o) => (o.ok ? [] : [o.code]))
    const byCode = Object.entries(
      codes.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c]: (acc[c] ?? 0) + 1 }), {}),
    )
      .map(([c, n]) => `${c} x${n}`)
      .join(', ')
    note(
      `S2 ${RACE_ATTEMPTS} racing signatures: payer charged once; ` +
        `${accepted.length} accepted (${finals.length} distinct jobs, ${reverted} reverted on-chain), ` +
        `refused: ${byCode || 'none'}`,
    )
  })

  it(`S3: ${SUBSCRIPTIONS} subscriptions enrolled at once, then charged by the scheduler`, async () => {
    const pool = await payers(SUBSCRIPTIONS, 100n)
    const amount = 1_500_000n
    const plans = await Promise.all(
      bulk.map((m) =>
        client(m).subscriptionPlans.create({
          name: 'stress monthly',
          amount: amount.toString(),
          currency: 'USDC',
          interval: 'monthly',
        }),
      ),
    )
    const work = pool.map((p, i) => ({
      payer: p,
      merchant: at(bulk, i % bulk.length),
      plan: at(plans, i % plans.length),
    }))
    const bodies = await Promise.all(
      work.map((w) =>
        signEnrolment(w.plan.id, amount, w.plan.intervalSeconds, signerFor(w.payer, w.merchant)),
      ),
    )
    const before = await Promise.all(pool.map((p) => usdcBalance(p.address)))

    const started = Date.now()
    const outcomes = await Promise.all(
      work.map((w, i) =>
        merchantRelay(w.merchant, '/v1/relay/subscriptions', {
          ...at(bodies, i),
          subscriptionInternalId: w.plan.id,
        }),
      ),
    )
    const refused = outcomes.filter((o) => !o.ok)
    expect(refused, JSON.stringify(refused.slice(0, 3))).toHaveLength(0)

    const planIds = plans.map((p) => p.id)
    const charged = await eventually(
      `${SUBSCRIPTIONS} first charges succeeded`,
      () =>
        db().subscriptionCharge.findMany({
          where: { status: 'succeeded', subscription: { planId: { in: planIds } } },
        }),
      (rows) => rows.length >= SUBSCRIPTIONS,
      300_000,
    )
    const firstChargeMs = Date.now() - started

    // Let the sweeper run several more times; nothing may be charged again.
    await sleep(20_000)
    const after = await db().subscriptionCharge.findMany({
      where: { subscription: { planId: { in: planIds } }, status: 'succeeded' },
    })
    expect(after).toHaveLength(SUBSCRIPTIONS)
    expect(new Set(after.map((c) => c.subscriptionId)).size).toBe(SUBSCRIPTIONS)
    for (const [i, p] of pool.entries()) {
      expect(at(before, i) - (await usdcBalance(p.address))).toBe(amount)
    }
    note(
      `S3 ${SUBSCRIPTIONS} enrolments: all first charges done in ${firstChargeMs} ms; ` +
        `${charged.length} charges, still ${after.length} after 4 more sweeps; each payer debited once`,
    )
  })

  it(`S4: ${REFUND_ATTEMPTS} refunds of 60% each against one payment, all at once`, async () => {
    const target = paidSessions[0]
    if (!target) throw new Error('S1 must run first')
    const tx = await db().transaction.findFirstOrThrow({ where: { sessionId: target.sessionId } })
    const sixty = (target.amount * 60n) / 100n
    const results = await Promise.allSettled(
      Array.from({ length: REFUND_ATTEMPTS }, () =>
        client(target.merchant).refunds.create({
          transactionId: tx.id,
          amount: sixty.toString(),
          reason: 'customer_request',
        }),
      ),
    )
    const accepted = results.filter((r) => r.status === 'fulfilled').length
    const open = await db().refund.findMany({
      where: {
        transactionId: tx.id,
        status: { in: ['pending', 'awaiting_signature', 'submitted', 'completed'] },
      },
    })
    const reserved = open.reduce((a, r) => a + BigInt(r.amount), 0n)
    note(
      `S4 ${REFUND_ATTEMPTS} concurrent 60% refunds on ${target.amount} base units: ` +
        `${accepted} accepted, ${reserved} reserved against the payment`,
    )
    expect(accepted).toBeLessThanOrEqual(1)
    expect(reserved).toBeLessThanOrEqual(target.amount)
  })
})

const paymentEnvelope = z.object({ data: z.object({ session: z.object({ id: z.string() }) }) })

// `dispatchedAt` is set when the dispatcher claims an event, before it hydrates the
// payload, so a claimed event can still hold its `{ ref }` form for a moment.
function sessionIdOf(payload: unknown): string | null {
  const hydrated = paymentEnvelope.safeParse(payload)
  return hydrated.success ? hydrated.data.data.session.id : null
}
