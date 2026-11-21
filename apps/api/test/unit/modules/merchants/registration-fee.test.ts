import { describe, expect, it } from 'vitest'
import { decodeFunctionData } from 'viem'
import type { MerchantTier } from '@strimz/shared-config'

import { registerMerchantCallData } from '../../../../src/modules/merchants/registration.js'
import { registerMerchantAbi } from '../../../../src/modules/merchants/registry.abi.js'

const WALLET = '0x1111111111111111111111111111111111111111'
const PAYOUT = '0x2222222222222222222222222222222222222222'

function registerArgs(tier: MerchantTier) {
  const { args } = decodeFunctionData({
    abi: registerMerchantAbi,
    data: registerMerchantCallData({
      tier,
      walletAddress: WALLET,
      payoutAddress: PAYOUT,
      onboardingCompleted: true,
    }),
  })
  return args
}

describe('registerMerchant call', () => {
  // ADR-2026-11-21-free-plan-fee-integrity: the fee is taken on chain from the first
  // payment, and the first $1,000 per business is refunded off chain.
  it('registers a Free merchant at the Starter fee with a 500 bps ceiling and no parent', () => {
    expect(registerArgs('free')).toEqual([WALLET, PAYOUT, 50, 500, 0n])
  })

  it.each<[MerchantTier, number]>([
    ['starter', 50],
    ['growth', 40],
  ])('registers a %s merchant at its plan fee under the same ceiling', (tier, feeBps) => {
    const [, , fee, ceiling] = registerArgs(tier)
    expect(fee).toBe(feeBps)
    expect(ceiling).toBe(500)
  })

  it('refuses to register an Enterprise merchant, whose fee is set by contract', () => {
    expect(() => registerArgs('enterprise')).toThrow(/enterprise/u)
  })
})
