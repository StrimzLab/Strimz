/**
 * Strimz pricing tiers.
 *
 * Fees are expressed in basis points (bps): 100 bps = 1%.
 * The subscription premium is added to the per-transaction rate when the
 * payment is recurring (i.e. originated from a SubscriptionPlan).
 */

import { PAYMENT_TOKENS, TOKENS, type PaymentToken } from './tokens.js'

export type MerchantTier = 'free' | 'starter' | 'growth' | 'enterprise'

export type VolumePlan = Exclude<MerchantTier, 'enterprise'>

export type PlanFeature = 'storefront' | 'anomaly_alerts' | 'yield_recommendations'

export interface PlanDefinition {
  id: MerchantTier
  name: string
  feeBps: number | null
  entersAtVolume: number | null
  features: readonly PlanFeature[]
  prioritySupport: boolean
}

const PAID_FEATURES: readonly PlanFeature[] = [
  'storefront',
  'anomaly_alerts',
  'yield_recommendations',
]

export const PLANS: Record<MerchantTier, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Free',
    feeBps: 0,
    entersAtVolume: 0,
    features: [],
    prioritySupport: false,
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    feeBps: 50,
    entersAtVolume: 1_000,
    features: PAID_FEATURES,
    prioritySupport: true,
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    feeBps: 40,
    entersAtVolume: 50_000,
    features: PAID_FEATURES,
    prioritySupport: true,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    feeBps: null,
    entersAtVolume: null,
    features: PAID_FEATURES,
    prioritySupport: true,
  },
}

export const DEFAULT_TIER: MerchantTier = 'free'

const PLAN_ORDER: readonly MerchantTier[] = ['free', 'starter', 'growth', 'enterprise']

const VOLUME_PLANS: readonly VolumePlan[] = ['free', 'starter', 'growth']

export const PLAN_FEE_CEILING_BPS: number = Math.max(
  ...VOLUME_PLANS.map((plan) => PLANS[plan].feeBps ?? 0),
)

export function planFeeBps(plan: MerchantTier): number | null {
  return PLANS[plan].feeBps
}

export function planIncludes(plan: MerchantTier, feature: PlanFeature): boolean {
  return PLANS[plan].features.includes(feature)
}

export function plansWith(feature: PlanFeature): MerchantTier[] {
  return PLAN_ORDER.filter((plan) => planIncludes(plan, feature))
}

export function lowestPlanWith(feature: PlanFeature): MerchantTier {
  const plan = PLAN_ORDER.find((candidate) => planIncludes(candidate, feature))
  if (!plan) throw new Error(`no plan includes ${feature}`)
  return plan
}

export type PaymentVolumes = Readonly<Record<PaymentToken, bigint>>

function thresholdInBaseUnits(plan: VolumePlan, token: PaymentToken): bigint {
  const wholeUnits = PLANS[plan].entersAtVolume
  if (wholeUnits === null) throw new Error(`${plan} has no volume threshold`)
  return BigInt(wholeUnits) * 10n ** BigInt(TOKENS[token].decimals)
}

export function planForVolume(volumes: PaymentVolumes): VolumePlan {
  let reached: VolumePlan = 'free'
  for (const plan of VOLUME_PLANS) {
    if (PAYMENT_TOKENS.some((token) => volumes[token] >= thresholdInBaseUnits(plan, token))) {
      reached = plan
    }
  }
  return reached
}
