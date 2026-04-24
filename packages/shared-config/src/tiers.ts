/**
 * Strimz pricing tiers.
 *
 * Fees are expressed in basis points (bps): 100 bps = 1%.
 * The subscription premium is added to the per-transaction rate when the
 * payment is recurring (i.e. originated from a SubscriptionPlan).
 */

export type MerchantTier = 'free' | 'growth' | 'business' | 'enterprise'

export interface TierDefinition {
  id: MerchantTier
  name: string
  /** Monthly fee in USD cents (0 for free, null for custom enterprise). */
  monthlyFeeUsdCents: number | null
  /** Per-transaction fee on one-shot payments, in basis points. */
  oneShotFeeBps: number | null
  /** Per-transaction premium added on subscription payments, in basis points. */
  subscriptionPremiumBps: number | null
  /** Monthly transaction volume cap in USD cents. `null` for unlimited. */
  monthlyVolumeCapUsdCents: number | null
  /** Whether the "Powered by Strimz" badge can be removed from checkout. */
  whiteLabelEligible: boolean
  /** Whether the tier includes priority support. */
  prioritySupport: boolean
}

export const TIERS: Record<MerchantTier, TierDefinition> = {
  free: {
    id: 'free',
    name: 'Free',
    monthlyFeeUsdCents: 0,
    oneShotFeeBps: 150, // 1.5%
    subscriptionPremiumBps: 20, // +0.2% on recurring => 1.7% effective
    monthlyVolumeCapUsdCents: 1_000_000, // $10,000
    whiteLabelEligible: false,
    prioritySupport: false,
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    monthlyFeeUsdCents: 4_900, // $49
    oneShotFeeBps: 80, // 0.8%
    subscriptionPremiumBps: 20, // 1.0% effective
    monthlyVolumeCapUsdCents: 10_000_000, // $100,000
    whiteLabelEligible: true,
    prioritySupport: false,
  },
  business: {
    id: 'business',
    name: 'Business',
    monthlyFeeUsdCents: 19_900, // $199
    oneShotFeeBps: 50, // 0.5%
    subscriptionPremiumBps: 20, // 0.7% effective
    monthlyVolumeCapUsdCents: 100_000_000, // $1,000,000
    whiteLabelEligible: true,
    prioritySupport: true,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyFeeUsdCents: null,
    oneShotFeeBps: null,
    subscriptionPremiumBps: null,
    monthlyVolumeCapUsdCents: null,
    whiteLabelEligible: true,
    prioritySupport: true,
  },
}

export const DEFAULT_TIER: MerchantTier = 'free'

export function getTier(id: MerchantTier): TierDefinition {
  return TIERS[id]
}

/**
 * Effective fee in bps for a given tier and payment kind.
 * Returns `null` for the enterprise tier (custom-priced).
 */
export function effectiveFeeBps(
  tier: MerchantTier,
  kind: 'one_shot' | 'subscription',
): number | null {
  const def = TIERS[tier]
  if (def.oneShotFeeBps === null) return null
  if (kind === 'one_shot') return def.oneShotFeeBps
  return def.oneShotFeeBps + (def.subscriptionPremiumBps ?? 0)
}
