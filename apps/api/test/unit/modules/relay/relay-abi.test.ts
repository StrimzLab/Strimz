import { describe, expect, it } from 'vitest'
import { toFunctionSelector } from 'viem'

import {
  payWithAuthorizationAbi,
  permitAndCreateSubscriptionAbi,
} from '../../../../src/modules/relay/generated/contracts.js'

// Selectors of the contract source that #142 deploys.
describe('relay ABIs', () => {
  it('payWithAuthorization matches StrimzPayments', () => {
    expect(toFunctionSelector(payWithAuthorizationAbi[0])).toBe('0x08aeff48')
  })

  it('permitAndCreateSubscription matches StrimzSubscriptions', () => {
    expect(toFunctionSelector(permitAndCreateSubscriptionAbi[0])).toBe('0x54d2fac0')
  })
})
