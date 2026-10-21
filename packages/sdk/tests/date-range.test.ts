import { describe, it, expect, vi } from 'vitest'
import { StrimzClient } from '../src/index.js'

const FROM = '2026-10-01T00:00:00Z'
const TO = '2026-11-01T00:00:00Z'

function client() {
  const fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify({ data: [], nextCursor: null, hasMore: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )
  const c = new StrimzClient({
    apiKey: `sk_test_${'a'.repeat(32)}`,
    baseUrl: 'https://api.test',
    maxRetries: 0,
    fetch: fetchMock as unknown as typeof fetch,
  })
  return { c, url: () => new URL(String(fetchMock.mock.calls[0]?.[0])) }
}

describe('date range filters', () => {
  it('transactions.list sends from and to', async () => {
    const { c, url } = client()

    await c.transactions.list({ from: FROM, to: TO })

    expect(url().pathname).toBe('/v1/transactions')
    expect(url().searchParams.get('from')).toBe(FROM)
    expect(url().searchParams.get('to')).toBe(TO)
  })

  it('agents.listActivity sends from and to', async () => {
    const { c, url } = client()

    await c.agents.listActivity({ from: FROM, to: TO })

    expect(url().pathname).toBe('/v1/agents/activity')
    expect(url().searchParams.get('from')).toBe(FROM)
    expect(url().searchParams.get('to')).toBe(TO)
  })
})
