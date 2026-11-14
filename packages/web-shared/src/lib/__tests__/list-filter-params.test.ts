import { afterEach, describe, expect, it, vi } from 'vitest'

import { AdminApiClient } from '../admin-api/client'
import { MerchantApi } from '../merchant-api'

const EMPTY_PAGE = { data: [], nextCursor: null, hasMore: false }
const FROM = '2026-10-01T00:00:00.000Z'
const TO = '2026-11-01T00:00:00.000Z'

function stubFetch() {
  const fetch = vi.fn().mockImplementation(() => Promise.resolve(Response.json(EMPTY_PAGE)))
  vi.stubGlobal('fetch', fetch)
  return () => new URL(String(fetch.mock.calls.at(-1)?.[0]))
}

const api = () =>
  new MerchantApi({
    baseUrl: 'https://api.strimz.test',
    getAccessToken: () => Promise.resolve('privy-token'),
    getMode: () => 'test',
  })

describe('list filter params', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends several statuses as one comma list', async () => {
    const lastUrl = stubFetch()

    await api().paymentSessions.list({ status: ['confirmed', 'expired'] })

    expect(lastUrl().searchParams.get('status')).toBe('confirmed,expired')
  })

  it('still sends a single status as is', async () => {
    const lastUrl = stubFetch()

    await api().paymentSessions.list({ status: 'confirmed' })

    expect(lastUrl().searchParams.get('status')).toBe('confirmed')
  })

  it.each([
    ['payment sessions', (a: MerchantApi) => a.paymentSessions.list({ from: FROM, to: TO })],
    ['subscriptions', (a: MerchantApi) => a.subscriptions.list({ from: FROM, to: TO })],
    ['invoices', (a: MerchantApi) => a.invoices.list({ from: FROM, to: TO })],
    ['refunds', (a: MerchantApi) => a.refunds.list({ from: FROM, to: TO })],
    [
      'webhook deliveries',
      (a: MerchantApi) => a.webhookEndpoints.listDeliveries({ from: FROM, to: TO }),
    ],
  ])('sends a date range for %s', async (_, call) => {
    const lastUrl = stubFetch()

    await call(api())

    expect(lastUrl().searchParams.get('from')).toBe(FROM)
    expect(lastUrl().searchParams.get('to')).toBe(TO)
  })

  it('filters webhook deliveries by status and event', async () => {
    const lastUrl = stubFetch()

    await api().webhookEndpoints.listDeliveries({
      status: ['retrying', 'permanently_failed'],
      eventName: ['payment.completed'],
    })

    expect(lastUrl().searchParams.get('status')).toBe('retrying,permanently_failed')
    expect(lastUrl().searchParams.get('eventName')).toBe('payment.completed')
  })

  it('sends several transaction kinds and agent outcomes', async () => {
    const lastUrl = stubFetch()

    await api().transactions.list({ kind: ['one_shot', 'refund'] })
    expect(lastUrl().searchParams.get('kind')).toBe('one_shot,refund')

    await api().agents.listActivity({ outcome: ['success', 'failure'] })
    expect(lastUrl().searchParams.get('outcome')).toBe('success,failure')
  })

  it('admin client sends several merchant statuses and tiers', async () => {
    const lastUrl = stubFetch()
    const admin = new AdminApiClient({
      getAccessToken: () => Promise.resolve('privy-token'),
      bffBaseUrl: 'https://app.strimz.test',
    })

    await admin.listMerchants({ status: ['active', 'suspended'], tier: ['growth'] })

    expect(lastUrl().searchParams.get('status')).toBe('active,suspended')
    expect(lastUrl().searchParams.get('tier')).toBe('growth')
  })
})
