import { describe, it, expect, vi } from 'vitest'
import { StrimzClient } from '../src/index.js'

const ID = 'cmq4wh9de0006je6l2n5v0kqt'
const TX_HASH = `0x${'a'.repeat(64)}`
const PAYER = `0x${'b'.repeat(40)}`

const refund = {
  id: ID,
  merchantId: 'cmq4wa1aa0000je6l0000aaaa',
  transactionId: 'cmq4wf2b80004je6l7xq1c9ad',
  amount: '50000000',
  currency: 'USDC',
  reason: 'customer_request',
  note: null,
  status: 'awaiting_signature',
  payerAddress: PAYER,
  refundTxHash: null,
  failureReason: null,
  initiatedBy: 'cmq4wa1aa0000je6l0000aaaa',
  createdAt: '2026-10-17T00:00:00.000Z',
  completedAt: null,
}

function clientReturning(body: unknown, status = 201) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  const client = new StrimzClient({
    apiKey: `sk_test_${'a'.repeat(32)}`,
    baseUrl: 'https://api.test',
    maxRetries: 0,
    fetch: fetchMock as unknown as typeof fetch,
  })
  return { client, fetchMock }
}

describe('refunds', () => {
  it('create returns the refund and its signing instructions', async () => {
    const signingInstructions = {
      token: `0x${'c'.repeat(40)}`,
      to: PAYER,
      amount: '50000000',
      note: 'Refund for transaction cmq4wf2b80004je6l7xq1c9ad',
    }
    const { client } = clientReturning({ refund, signingInstructions })

    const out = await client.refunds.create({
      transactionId: refund.transactionId,
      amount: '50000000',
      reason: 'customer_request',
    })

    expect(out.refund.id).toBe(ID)
    expect(out.signingInstructions).toEqual(signingInstructions)
  })

  it('submitSignature sends only the tx hash in the body', async () => {
    const { client, fetchMock } = clientReturning(
      { ...refund, status: 'submitted', refundTxHash: TX_HASH },
      200,
    )

    await client.refunds.submitSignature({ id: ID, refundTxHash: TX_HASH })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`https://api.test/v1/refunds/${ID}/signature`)
    expect(JSON.parse(init.body as string)).toEqual({ refundTxHash: TX_HASH })
  })
})
