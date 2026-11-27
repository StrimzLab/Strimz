import { describe, expect, it } from 'vitest'
import { resolveNetworks, type NetworkInputs } from '../networks'

const live: NetworkInputs['primary'] = {
  arcEnvironment: 'mainnet',
  apiUrl: 'https://api.strimz.finance',
  arcRpcUrl: 'https://rpc.mainnet.arc.io',
  checkoutUrl: 'https://checkout.strimz.finance',
  publishableKey: 'pk_live_abc',
}
const test: NetworkInputs['test'] = {
  apiUrl: 'https://api-test.strimz.finance/',
  checkoutUrl: 'https://checkout-test.strimz.finance',
  arcRpcUrl: 'https://rpc.testnet.arc.io',
  publishableKey: 'pk_test_abc',
}

describe('resolveNetworks', () => {
  it('offers test and live on a mainnet build with the test settings', () => {
    const n = resolveNetworks({ primary: live, test })
    expect(n.map((x) => x.mode)).toEqual(['test', 'live'])
    expect(n[0]).toEqual({
      mode: 'test',
      arcEnvironment: 'testnet',
      apiUrl: 'https://api-test.strimz.finance',
      arcRpcUrl: 'https://rpc.testnet.arc.io',
      checkoutUrl: 'https://checkout-test.strimz.finance',
      publishableKey: 'pk_test_abc',
    })
    expect(n[1]?.mode).toBe('live')
    expect(n[1]?.apiUrl).toBe('https://api.strimz.finance')
  })

  it('is live only without the test API and checkout', () => {
    expect(resolveNetworks({ primary: live, test: {} }).map((x) => x.mode)).toEqual(['live'])
    expect(
      resolveNetworks({ primary: live, test: { apiUrl: test.apiUrl } }).map((x) => x.mode),
    ).toEqual(['live'])
  })

  it('lets the test publishable key wait', () => {
    const n = resolveNetworks({ primary: live, test: { ...test, publishableKey: undefined } })
    expect(n[0]?.publishableKey).toBe('')
  })

  it('is test only on a testnet build, ignoring test settings', () => {
    const n = resolveNetworks({ primary: { ...live, arcEnvironment: 'testnet' }, test })
    expect(n.map((x) => x.mode)).toEqual(['test'])
    expect(n[0]?.apiUrl).toBe('https://api.strimz.finance')
  })

  it('refuses a test API that is not https', () => {
    expect(() =>
      resolveNetworks({
        primary: live,
        test: { ...test, apiUrl: 'http://api-test.strimz.finance' },
      }),
    ).toThrow(/NEXT_PUBLIC_TEST_API_URL/u)
  })
})
