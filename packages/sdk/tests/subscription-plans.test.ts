import { describe, it, expect, vi } from 'vitest'
import { StrimzClient } from '../src/index.js'

const ID = 'cmq4wh9de0006je6l2n5v0kqt'
const SUCCESS = 'https://app.example/welcome?sub={SUBSCRIPTION_ID}'

const plan = {
  id: ID,
  merchantId: 'cmq4wa1aa0000je6l0000aaaa',
  chainMerchantId: '1',
  tokenAddress: `0x${'c'.repeat(40)}`,
  intervalSeconds: 2_592_000,
  name: 'Pro',
  description: null,
  amount: '20000000',
  currency: 'USDC',
  interval: 'monthly',
  intervalCount: 1,
  trialPeriodDays: null,
  status: 'active',
  successUrl: SUCCESS,
  cancelUrl: null,
  metadata: {},
  createdAt: '2026-10-23T00:00:00.000Z',
  updatedAt: '2026-10-23T00:00:00.000Z',
}

function clientReturning(body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
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
  return { client, fetchMock }
}

describe('subscriptionPlans.update', () => {
  it('PATCHes only the return URLs and returns the plan', async () => {
    const { client, fetchMock } = clientReturning(plan)

    const out = await client.subscriptionPlans.update(ID, { successUrl: SUCCESS, cancelUrl: null })

    expect(out.successUrl).toBe(SUCCESS)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`https://api.test/v1/subscription-plans/${ID}`)
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body as string)).toEqual({ successUrl: SUCCESS, cancelUrl: null })
  })

  it('rejects a non-http URL before sending', () => {
    const { client, fetchMock } = clientReturning(plan)

    expect(() =>
      client.subscriptionPlans.update(ID, { successUrl: 'javascript:alert(1)' }),
    ).toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
