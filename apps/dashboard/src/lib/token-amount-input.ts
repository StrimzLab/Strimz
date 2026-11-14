import { parseUnits } from 'viem'
import { TOKENS } from '@strimz/shared-config'
import type { PaymentCurrency } from '@strimz/shared-types'

const DECIMAL = /^\d+(\.\d+)?$/u

export type TokenAmountResult = { ok: true; amount: bigint } | { ok: false; error: string }

export function parseTokenAmountInput(
  text: string,
  currency: PaymentCurrency,
  emptyError: string,
): TokenAmountResult {
  const value = text.trim()
  if (value === '') return { ok: false, error: emptyError }
  if (!DECIMAL.test(value)) return { ok: false, error: 'Enter a valid amount' }
  const decimals = TOKENS[currency].decimals
  if ((value.split('.')[1] ?? '').length > decimals) {
    return { ok: false, error: `Enter at most ${decimals} decimal places` }
  }
  return { ok: true, amount: parseUnits(value, decimals) }
}
