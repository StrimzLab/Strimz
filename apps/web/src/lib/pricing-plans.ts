import {
  PLANS,
  lowestPlanWith,
  planFeeBps,
  planIncludes,
  type MerchantTier,
  type PlanFeature,
} from '@strimz/shared-config'

export interface PricingPlan {
  tier: MerchantTier
  name: string
  price: string
  threshold: string
  cta: { href: string; label: string }
  featured: boolean
  features: readonly string[]
  excluded: readonly string[]
}

export interface PlanComparisonRow {
  label: string
  values: ReadonlyArray<string | boolean>
}

const ORDER: readonly MerchantTier[] = ['free', 'starter', 'growth', 'enterprise']

const FEATURE_NAMES: Record<PlanFeature, string> = {
  storefront: 'the storefront builder',
  anomaly_alerts: 'anomaly alerts',
  yield_recommendations: 'yield recommendations',
}

function dollars(amount: number): string {
  return `$${amount.toLocaleString('en-US')}`
}

function feePercent(bps: number): string {
  return `${bps / 100}%`
}

function entersAt(tier: MerchantTier): number {
  const volume = PLANS[tier].entersAtVolume
  if (volume === null) throw new Error(`the ${tier} plan has no volume threshold`)
  return volume
}

export function planFeeLabel(tier: MerchantTier): string {
  const bps = planFeeBps(tier)
  return bps === null ? 'Custom rate agreed with Strimz' : `${feePercent(bps)} per transaction`
}

function startsAt(tier: MerchantTier): string {
  const volume = PLANS[tier].entersAtVolume
  if (volume === null) return 'By contract'
  return volume === 0 ? 'Sign-up' : dollars(volume)
}

function price(tier: MerchantTier): string {
  const bps = planFeeBps(tier)
  return bps === null ? 'Custom' : feePercent(bps)
}

export const PRICING_PLANS: readonly PricingPlan[] = [
  {
    tier: 'free',
    name: PLANS.free.name,
    price: price('free'),
    threshold: `First ${dollars(entersAt('starter'))} processed`,
    cta: { href: '/login', label: 'Start free' },
    featured: false,
    features: [
      'One-time payments and subscriptions',
      'Refunds, invoices, and webhooks',
      'Billing recovery emails (opt-in)',
      'Daily cashflow digest (opt-in)',
    ],
    excluded: [
      'Storefront builder',
      'Anomaly alerts and yield recommendations',
      'Priority email support',
    ],
  },
  {
    tier: 'starter',
    name: PLANS.starter.name,
    price: price('starter'),
    threshold: `From ${dollars(entersAt('starter'))} processed`,
    cta: { href: '/login', label: 'Start with Starter' },
    featured: true,
    features: [
      'Everything in Free',
      'Branded storefront builder',
      'Cashflow anomaly alerts',
      'Yield recommendations',
      'Priority email support',
    ],
    excluded: [],
  },
  {
    tier: 'growth',
    name: PLANS.growth.name,
    price: price('growth'),
    threshold: `From ${dollars(entersAt('growth'))} processed`,
    cta: { href: '/login', label: 'Start with Growth' },
    featured: false,
    features: ['Everything in Starter', 'A lower rate on every payment'],
    excluded: [],
  },
  {
    tier: 'enterprise',
    name: PLANS.enterprise.name,
    price: price('enterprise'),
    threshold: 'By contract',
    cta: { href: '/contact', label: 'Contact us' },
    featured: false,
    features: ['Everything in Growth', 'Custom pricing by contract'],
    excluded: [],
  },
]

function byPlan(include: (tier: MerchantTier) => boolean): boolean[] {
  return ORDER.map(include)
}

export const PLAN_COMPARISON: readonly PlanComparisonRow[] = [
  { label: 'Per-transaction fee', values: ORDER.map(price) },
  { label: 'Starts at all-time volume', values: ORDER.map(startsAt) },
  { label: 'Payments, refunds, invoices and webhooks', values: byPlan(() => true) },
  { label: 'Recovery emails and cashflow digest (opt-in)', values: byPlan(() => true) },
  {
    label: 'Storefront builder',
    values: byPlan((tier) => planIncludes(tier, 'storefront')),
  },
  {
    label: 'Anomaly alerts and yield recommendations',
    values: byPlan(
      (tier) => planIncludes(tier, 'anomaly_alerts') && planIncludes(tier, 'yield_recommendations'),
    ),
  },
  {
    label: 'Priority email support',
    values: byPlan((tier) => PLANS[tier].prioritySupport),
  },
]

export function planLockedNotice(feature: PlanFeature): { title: string; body: string } {
  const required = lowestPlanWith(feature)
  const name = FEATURE_NAMES[feature]
  return {
    title: `${name.charAt(0).toUpperCase()}${name.slice(1)} starts on ${PLANS[required].name}`,
    body: `Unlocks automatically at ${dollars(entersAt(required))} processed. Every merchant starts on Free and moves up as volume grows.`,
  }
}

export function nextPlanNotice(tier: MerchantTier): string | null {
  if (tier === 'free' || tier === 'starter') {
    const next = tier === 'free' ? 'starter' : 'growth'
    return `Moves to ${PLANS[next].name} (${price(next)}) automatically at ${dollars(entersAt(next))} processed.`
  }
  if (tier === 'growth') return 'Need a custom rate? Talk to us about Enterprise pricing.'
  return null
}
