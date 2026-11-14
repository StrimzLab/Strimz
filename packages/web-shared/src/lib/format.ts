import { formatDistanceToNowStrict } from 'date-fns'
import { formatUnits } from 'viem'

/**
 * Token-amount formatters used by the dashboard.
 *
 * Why this lives outside `@/data/_seed`: that file is for stubbed
 * data + its formatters share signatures with the API shape but aren't
 * scoped to it. As we migrate pages off seeds, the formatters live in
 * `@/lib/format` so the seeds can be deleted without breaking pages.
 *
 * Decimals: USDC + EURC are both 6-decimal stablecoins on Arc. If a
 * future currency ships with different decimals, plumb the decimals
 * through and remove the hardcoded `6`.
 */
const STABLECOIN_DECIMALS = 6

export function formatTokenAmount(raw: string, currency = 'USDC'): string {
  const value = formatUnits(BigInt(raw), STABLECOIN_DECIMALS)
  return `${trimTrailingZeros(value)} ${currency}`
}

/** Numeric form for arithmetic. Sums, percentages, etc. */
export function tokenAmountToNumber(raw: string): number {
  return Number(formatUnits(BigInt(raw), STABLECOIN_DECIMALS))
}

function trimTrailingZeros(value: string): string {
  if (!value.includes('.')) return value
  return value.replace(/\.?0+$/u, '') || '0'
}

/** "0xFd02…7150" */
export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

/**
 * Human relative time. Handles both past ("3 days ago") and future
 * ("in 14 days"). Powered by date-fns so we never render raw negative
 * seconds again when a due date is in the future.
 */
export function relativeTime(iso: string): string {
  const target = new Date(iso)
  if (Number.isNaN(target.getTime())) return '—'
  return formatDistanceToNowStrict(target, { addSuffix: true, roundingMethod: 'round' })
}
