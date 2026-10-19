import { PLANS, TOKENS, planForVolume, type VolumePlan } from '@strimz/shared-config'

const TIERS = (['free', 'starter', 'growth'] as const satisfies readonly VolumePlan[]).map(
  (tier) => ({
    fromCents: (PLANS[tier].entersAtVolume ?? 0) * 100,
    bps: PLANS[tier].feeBps ?? 0,
  }),
)

function strimzFeeCents(processedCents: number, amountCents: number): number {
  let fee = 0
  let cursor = processedCents
  const end = processedCents + amountCents
  TIERS.forEach((tier, i) => {
    const next = TIERS[i + 1]?.fromCents ?? Infinity
    const from = Math.max(cursor, tier.fromCents)
    const to = Math.min(end, next)
    if (to > from) {
      fee += ((to - from) * tier.bps) / 10_000
      cursor = to
    }
  })
  return fee
}

/** Twelve months at a steady monthly volume, in dollars. Plans move up with all-time volume. */
export function firstYearFees(monthlyVolume: number): {
  processed: number
  fees: number
  kept: number
  effectiveRate: number
} {
  const monthCents = Math.round(monthlyVolume * 100)
  if (monthCents <= 0) return { processed: 0, fees: 0, kept: 0, effectiveRate: 0 }

  let feeCents = 0
  for (let month = 0; month < 12; month++) {
    feeCents += strimzFeeCents(month * monthCents, monthCents)
  }

  const processed = (monthCents * 12) / 100
  const fees = Math.round(feeCents) / 100
  return { processed, fees, kept: processed - fees, effectiveRate: (fees / processed) * 100 }
}

/** The plan a merchant is on after this much all-time volume, priced as USDC. */
export function planAtVolume(allTimeUsd: number): VolumePlan {
  const cents = BigInt(Math.round(allTimeUsd * 100))
  const usdc = cents * 10n ** BigInt(TOKENS.USDC.decimals - 2)
  return planForVolume({ USDC: usdc, EURC: 0n })
}

export function planAfterYear(monthlyVolume: number): VolumePlan {
  return planAtVolume(monthlyVolume * 12)
}
