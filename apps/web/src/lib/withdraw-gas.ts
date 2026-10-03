export interface GasQuote {
  gas: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
}

const NATIVE_PER_USDC_BASE_UNIT = 10n ** 12n

export function bufferedGasQuote(estimate: GasQuote): GasQuote {
  return {
    gas: (estimate.gas * 6n + 4n) / 5n,
    maxFeePerGas: estimate.maxFeePerGas * 2n,
    maxPriorityFeePerGas: estimate.maxPriorityFeePerGas,
  }
}

export function gasReserveUsdc(quote: GasQuote): bigint {
  const nativeCost = quote.gas * quote.maxFeePerGas
  return (nativeCost + NATIVE_PER_USDC_BASE_UNIT - 1n) / NATIVE_PER_USDC_BASE_UNIT
}

export type WithdrawCurrency = 'USDC' | 'EURC'

interface WithdrawBalances {
  currency: WithdrawCurrency
  balance: bigint
  usdcBalance: bigint
  reserve: bigint
}

export function maxWithdrawable(input: WithdrawBalances): bigint {
  if (input.currency === 'EURC') return input.balance
  return input.balance > input.reserve ? input.balance - input.reserve : 0n
}

export type WithdrawCheck =
  | { ok: true }
  | { ok: false; reason: 'not_positive' | 'exceeds_balance' | 'insufficient_gas' }

export function checkWithdrawAmount(input: WithdrawBalances & { amount: bigint }): WithdrawCheck {
  if (input.amount <= 0n) return { ok: false, reason: 'not_positive' }
  if (input.amount > input.balance) return { ok: false, reason: 'exceeds_balance' }
  const usdcLeftForGas =
    input.currency === 'USDC' ? input.usdcBalance - input.amount : input.usdcBalance
  if (usdcLeftForGas < input.reserve) return { ok: false, reason: 'insufficient_gas' }
  return { ok: true }
}
