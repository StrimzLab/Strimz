import { afterEach, describe, expect, it, vi } from 'vitest'
import { AdminApiClient } from '../admin-api/client'
import type { Network } from '../networks'

// ADR-2026-11-26-test-mode: admin reads and writes follow the Test / Live switch.
const test: Network = {
  mode: 'test',
  arcEnvironment: 'testnet',
  apiUrl: 'https://api-test.example.com',
  arcRpcUrl: '',
  checkoutUrl: 'https://checkout-test.example.com',
  publishableKey: '',
}

function stubFetch() {
  const fetch = vi.fn().mockImplementation(() => Promise.resolve(Response.json({})))
  vi.stubGlobal('fetch', fetch)
  vi.stubGlobal('window', { location: { origin: 'https://admin.example.com' } })
  return fetch
}

const call = (fetch: ReturnType<typeof vi.fn>) =>
  fetch.mock.calls.at(-1) as [URL, { headers: Record<string, string> }]

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AdminApiClient with a network', () => {
  it('reads from that network’s API', async () => {
    const fetch = stubFetch()
    const client = new AdminApiClient({
      getAccessToken: () => Promise.resolve('tok'),
      network: test,
    })
    await client.me()
    expect(String(call(fetch)[0])).toBe('https://api-test.example.com/v1/admin/me')
  })

  it('tells the admin write routes which mode it is in', async () => {
    const fetch = stubFetch()
    const client = new AdminApiClient({
      getAccessToken: () => Promise.resolve('tok'),
      network: test,
    })
    await client.setMerchantStatus('mer_1', { status: 'suspended', reason: 'x' } as never)
    const [url, init] = call(fetch)
    expect(url.origin).toBe('https://admin.example.com')
    expect(init.headers['x-strimz-mode']).toBe('test')
  })
})
