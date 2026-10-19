import { describe, it, expect, vi } from 'vitest'
import { StrimzClient } from '../src/index.js'

const CUSTOMER = 'cmq4wh9de0006je6l2n5v0kqt'

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

describe('customer filters', () => {
  it.each([
    ['paymentSessions', '/v1/payment-sessions'],
    ['subscriptions', '/v1/subscriptions'],
    ['transactions', '/v1/transactions'],
    ['refunds', '/v1/refunds'],
    ['invoices', '/v1/invoices'],
  ] as const)('%s.list sends customerId', async (resource, path) => {
    const { c, url } = client()

    await c[resource].list({ customerId: CUSTOMER })

    expect(url().pathname).toBe(path)
    expect(url().searchParams.get('customerId')).toBe(CUSTOMER)
  })

  it('customers.list sends walletAddress', async () => {
    const { c, url } = client()
    const wallet = `0x${'ab'.repeat(20)}`

    await c.customers.list({ walletAddress: wallet })

    expect(url().searchParams.get('walletAddress')).toBe(wallet)
  })
})
