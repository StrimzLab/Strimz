import { describe, expect, it } from 'vitest'

import {
  buildViewSubscriptionsTypedData,
  VIEW_SUBSCRIPTIONS_TYPES,
  VIEW_SUBSCRIPTIONS_VALIDITY_SECONDS,
} from '../src/eip712/index.js'

describe('ViewSubscriptions', () => {
  it('signs the payer and the time it was issued, on a Strimz domain with no contract', () => {
    const typed = buildViewSubscriptionsTypedData({
      chainId: 5042002,
      payer: '0x0000000000000000000000000000000000000abc',
      issuedAt: 1_700_000_000n,
    })
    expect(typed.domain).toEqual({ name: 'Strimz', version: '1', chainId: 5042002 })
    expect(typed.primaryType).toBe('ViewSubscriptions')
    expect(VIEW_SUBSCRIPTIONS_TYPES.ViewSubscriptions).toEqual([
      { name: 'payer', type: 'address' },
      { name: 'issuedAt', type: 'uint256' },
    ])
    expect(typed.message).toEqual({
      payer: '0x0000000000000000000000000000000000000abc',
      issuedAt: 1_700_000_000n,
    })
  })

  it('is valid for ten minutes', () => {
    expect(VIEW_SUBSCRIPTIONS_VALIDITY_SECONDS).toBe(600)
  })
})
