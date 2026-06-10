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
  // formatUnits returns a string like "1.5" or "0.000001". We trim
  // trailing zeros past two decimals so 1.5 reads cleanly while keeping
  // sub-cent precision when present.
  const value = formatUnits(BigInt(raw), STABLECOIN_DECIMALS)
  return `${trimTrailingZeros(value)} ${currency}`
}

/** Numeric form for arithmetic — sums, percentages, etc. */
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

/** Relative-time formatter for createdAt fields. */
export function relativeTime(iso: string, now = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime()
  const diffSec = Math.round(diffMs / 1000)
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  if (diffDay < 30) return `${diffDay}d ago`
  return new Date(iso).toLocaleDateString()
}
