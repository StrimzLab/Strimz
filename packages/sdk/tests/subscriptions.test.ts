import { describe, it, expect, vi } from 'vitest'
import { StrimzClient } from '../src/index.js'

const SUB = 'cmq4wh9de0006je6l2n5v0kqt'

const charge = {
  id: 'cmq4wk1aa0009je6l0000bbbb',
  subscriptionId: SUB,
  merchantId: 'cmq4wa1aa0000je6l0000aaaa',
  chargeAttemptId: `0x${'1'.repeat(64)}`,
  periodStartAt: '2026-10-01T00:00:00.000Z',
  periodEndAt: '2026-11-01T00:00:00.000Z',
  amount: '20000000',
  currency: 'USDC',
  status: 'failed',
  outcome: 'token_not_allowed',
  attemptNumber: 1,
  scheduledAt: '2026-11-01T00:00:00.000Z',
  executedAt: '2026-11-01T00:00:05.000Z',
  onchainTxHash: null,
  failureReason: null,
  createdAt: '2026-11-01T00:00:05.000Z',
  updatedAt: '2026-11-01T00:00:05.000Z',
}

// ADR-2026-11-13-sdk-subscription-charges (#446).
describe('subscriptions.charges', () => {
  it('reads one page of charge attempts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [charge], nextCursor: charge.id, hasMore: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const client = new StrimzClient({
      apiKey: `sk_test_${'a'.repeat(32)}`,
      baseUrl: 'https://api.test',
      maxRetries: 0,
      fetch: fetchMock as unknown as typeof fetch,
    })

    const page = await client.subscriptions.charges(SUB, { limit: 25, cursor: 'c_1' })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method ?? 'GET').toBe('GET')
    const u = new URL(url)
    expect(u.pathname).toBe(`/v1/subscriptions/${SUB}/charges`)
    expect(u.searchParams.get('limit')).toBe('25')
    expect(u.searchParams.get('cursor')).toBe('c_1')
    expect(page.data[0]?.outcome).toBe('token_not_allowed')
    expect(page.hasMore).toBe(true)
  })
})
