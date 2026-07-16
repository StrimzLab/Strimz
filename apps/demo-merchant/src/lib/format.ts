/**
 * Small utilities for turning UI dollar values into the base-6 USDC
 * integer Strimz expects, and the reverse for display.
 */

const USDC_DECIMALS = 6

/** '5' → '5000000'. Accepts up to 6 decimals. */
export function dollarsToUsdcBaseUnits(dollars: string | number): string {
  const s = String(dollars).trim()
  if (!/^\d+(\.\d+)?$/.test(s)) {
    throw new Error(`Invalid dollar amount: ${s}`)
  }
  const [whole, frac = ''] = s.split('.')
  if (frac.length > USDC_DECIMALS) {
    throw new Error(`USDC supports at most ${USDC_DECIMALS} decimals`)
  }
  const padded = frac.padEnd(USDC_DECIMALS, '0')
  const combined = `${whole}${padded}`.replace(/^0+/, '') || '0'
  return combined
}

/** '5000000' → '5.00'. Never returns scientific notation. */
export function formatUsdc(base: string | bigint): string {
  const bi = typeof base === 'string' ? BigInt(base) : base
  const scale = 10n ** BigInt(USDC_DECIMALS)
  const whole = bi / scale
  const frac = bi % scale
  const fracStr = frac.toString().padStart(USDC_DECIMALS, '0').slice(0, 2)
  return `${whole}.${fracStr}`
}
