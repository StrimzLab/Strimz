import { describe, expect, it } from 'vitest'
import * as config from '../src/index.js'
import {
  DEFAULT_TIER,
  PLAN_FEE_CEILING_BPS,
  PLANS,
  lowestPlanWith,
  planFeeBps,
  planForVolume,
  planIncludes,
  planUpgradeFor,
  plansWith,
  type MerchantTier,
} from '../src/index.js'

const UNIT = 1_000_000n

function volumes(usdc: bigint, eurc: bigint) {
  return { USDC: usdc * UNIT, EURC: eurc * UNIT }
}

describe('plan table', () => {
  it('lists Free, Starter, Growth and Enterprise in order', () => {
    expect(Object.keys(PLANS)).toEqual(['free', 'starter', 'growth', 'enterprise'])
  })

  it('charges Free 0, Starter 50 and Growth 40 bps, and Enterprise by contract', () => {
    expect(planFeeBps('free')).toBe(0)
    expect(planFeeBps('starter')).toBe(50)
    expect(planFeeBps('growth')).toBe(40)
    expect(planFeeBps('enterprise')).toBeNull()
  })

  it('starts every merchant on Free', () => {
    expect(DEFAULT_TIER).toBe('free')
  })

  it('sets the registry ceiling to the highest plan fee', () => {
    expect(PLAN_FEE_CEILING_BPS).toBe(50)
  })

  it('has no monthly fee and no subscription premium', () => {
    for (const plan of Object.values(PLANS)) {
      expect(plan).not.toHaveProperty('monthlyFeeUsdCents')
      expect(plan).not.toHaveProperty('subscriptionPremiumBps')
    }
    expect(config).not.toHaveProperty('effectiveFeeBps')
  })

  it('gives priority email support from Starter', () => {
    expect(PLANS.free.prioritySupport).toBe(false)
    expect(PLANS.starter.prioritySupport).toBe(true)
    expect(PLANS.growth.prioritySupport).toBe(true)
    expect(PLANS.enterprise.prioritySupport).toBe(true)
  })
})

describe('plan features', () => {
  const paid: MerchantTier[] = ['starter', 'growth', 'enterprise']

  it.each(['storefront', 'anomaly_alerts', 'yield_recommendations'] as const)(
    'keeps %s off Free and on from Starter',
    (feature) => {
      expect(planIncludes('free', feature)).toBe(false)
      for (const plan of paid) expect(planIncludes(plan, feature)).toBe(true)
      expect(lowestPlanWith(feature)).toBe('starter')
      expect(plansWith(feature)).toEqual(paid)
    },
  )
})

describe('planForVolume', () => {
  it('stays Free below 1,000 in both currencies', () => {
    expect(planForVolume(volumes(0n, 0n))).toBe('free')
    expect(planForVolume({ USDC: 1_000n * UNIT - 1n, EURC: 999n * UNIT })).toBe('free')
  })

  it('does not add USDC and EURC together', () => {
    expect(planForVolume(volumes(600n, 600n))).toBe('free')
    expect(planForVolume(volumes(49_999n, 49_999n))).toBe('starter')
  })

  it('moves to Starter at 1,000 in either currency', () => {
    expect(planForVolume(volumes(1_000n, 0n))).toBe('starter')
    expect(planForVolume(volumes(0n, 1_000n))).toBe('starter')
  })

  it('moves to Growth at 50,000 in either currency', () => {
    expect(planForVolume(volumes(50_000n, 0n))).toBe('growth')
    expect(planForVolume(volumes(10n, 50_000n))).toBe('growth')
  })

  it('stays Growth above 1,000,000 until an Enterprise contract', () => {
    expect(planForVolume(volumes(5_000_000n, 0n))).toBe('growth')
  })
})

describe('planUpgradeFor', () => {
  it('names the higher plan the volume earns', () => {
    expect(planUpgradeFor('free', volumes(1_000n, 0n))).toBe('starter')
    expect(planUpgradeFor('free', volumes(0n, 50_000n))).toBe('growth')
    expect(planUpgradeFor('starter', volumes(50_000n, 0n))).toBe('growth')
  })

  it('returns null when the volume earns the current plan or a lower one', () => {
    expect(planUpgradeFor('free', volumes(600n, 600n))).toBeNull()
    expect(planUpgradeFor('starter', volumes(1_000n, 0n))).toBeNull()
    expect(planUpgradeFor('starter', volumes(0n, 0n))).toBeNull()
    expect(planUpgradeFor('growth', volumes(5_000_000n, 0n))).toBeNull()
  })

  it('never moves an Enterprise merchant', () => {
    expect(planUpgradeFor('enterprise', volumes(5_000_000n, 0n))).toBeNull()
  })
})
