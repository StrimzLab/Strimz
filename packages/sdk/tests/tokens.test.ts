import { describe, expect, it } from 'vitest'
import type { TokenMetadata } from '@strimz/shared-types'

import { selectPaymentPath, selectSubscriptionPath } from '../src/resources/tokens.js'

const TOKEN = '0x3600000000000000000000000000000000000000' as const

function meta(over: Partial<TokenMetadata['capabilities']> = {}): TokenMetadata {
  return {
    address: TOKEN,
    name: 'USD Coin',
    symbol: 'USDC',
    version: '2',
    decimals: 6,
    capabilities: {
      permit2612: true,
      transferAuth3009: true,
      ...over,
    },
  }
}

describe('selectPaymentPath', () => {
  it('picks pay_with_authorization when the token supports EIP-3009', () => {
    expect(selectPaymentPath(meta({ transferAuth3009: true }))).toBe('pay_with_authorization')
  })

  it('falls back to approve_then_pay when EIP-3009 is unavailable', () => {
    expect(selectPaymentPath(meta({ transferAuth3009: false }))).toBe('approve_then_pay')
  })

  it('does not depend on the permit2612 capability', () => {
    // A token that supports 2612 but not 3009 still falls back —
    // 2612 is the wrong primitive for a one-shot payment.
    expect(
      selectPaymentPath(meta({ transferAuth3009: false, permit2612: true })),
    ).toBe('approve_then_pay')
  })
})

describe('selectSubscriptionPath', () => {
  it('picks permit_and_create_subscription when the token supports EIP-2612', () => {
    expect(selectSubscriptionPath(meta({ permit2612: true }))).toBe(
      'permit_and_create_subscription',
    )
  })

  it('falls back to approve_then_create_subscription when EIP-2612 is unavailable', () => {
    expect(selectSubscriptionPath(meta({ permit2612: false }))).toBe(
      'approve_then_create_subscription',
    )
  })

  it('does not depend on the transferAuth3009 capability', () => {
    expect(
      selectSubscriptionPath(meta({ permit2612: false, transferAuth3009: true })),
    ).toBe('approve_then_create_subscription')
  })
})
