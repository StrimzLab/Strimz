export interface PayerBalanceInput {
  balance: bigint | undefined
  amount: bigint
  decimals: number
  symbol: string
}

export interface PayerBalance {
  state: 'unknown' | 'short' | 'enough'
  message: string | null
}

function display(value: bigint, decimals: number, roundUp: boolean): string {
  const unit = 10n ** BigInt(Math.max(decimals - 2, 0))
  let cents = value / unit
  if (roundUp && value % unit !== 0n) cents += 1n
  const whole = cents / 100n
  const frac = (cents % 100n).toString().padStart(2, '0')
  return `${whole.toString()}.${frac}`
}

export function payerBalance({
  balance,
  amount,
  decimals,
  symbol,
}: PayerBalanceInput): PayerBalance {
  if (balance === undefined) return { state: 'unknown', message: null }
  if (balance >= amount) return { state: 'enough', message: null }
  const has = display(balance, decimals, false)
  const missing = display(amount - balance, decimals, true)
  return {
    state: 'short',
    message: `This wallet has ${has} ${symbol}. Add ${missing} ${symbol} to pay.`,
  }
}
