import { describe, expect, it } from 'vitest'
import { decodeFunctionData } from 'viem'
import { DEFAULT_TIER, effectiveFeeBps, type MerchantTier } from '@strimz/shared-config'

import { registerMerchantCallData } from '../../../../src/modules/merchants/registration.js'
import { registerMerchantAbi } from '../../../../src/modules/merchants/registry.abi.js'

const WALLET = '0x1111111111111111111111111111111111111111'
const PAYOUT = '0x2222222222222222222222222222222222222222'
const TIERS: MerchantTier[] = ['free', 'growth', 'business', 'enterprise']

function registeredFeeBps(tier: MerchantTier): number {
  const merchantRow = {
    tier,
    walletAddress: WALLET,
    payoutAddress: PAYOUT,
    onboardingCompleted: true,
  }
  const { args } = decodeFunctionData({
    abi: registerMerchantAbi,
    data: registerMerchantCallData(merchantRow),
  })
  return Number(args[2])
}

describe('registerMerchant fee', () => {
  const defaultFee = effectiveFeeBps(DEFAULT_TIER, 'one_shot')

  it('is the default tier fee of 150 bps', () => {
    expect(defaultFee).toBe(150)
  })

  it.each(TIERS)('writes the default fee for a merchant whose tier is %s', (tier) => {
    expect(registeredFeeBps(tier)).toBe(defaultFee)
  })
})
