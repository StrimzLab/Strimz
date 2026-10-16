import {
  paymentCurrencySchema,
  tokenAmountSchema,
  type CurrencyAmounts,
} from '@strimz/shared-types'

export interface CurrencyAmountRow {
  currency: string
  amount: string
}

export function zeroCurrencyAmounts(): CurrencyAmounts {
  return { USDC: '0', EURC: '0' }
}

export function toCurrencyAmounts(rows: readonly CurrencyAmountRow[]): CurrencyAmounts {
  const out = zeroCurrencyAmounts()
  const seen = new Set<string>()
  for (const row of rows) {
    const currency = paymentCurrencySchema.safeParse(row.currency)
    if (!currency.success) {
      throw new Error(`unknown currency in aggregate row: ${JSON.stringify(row.currency)}`)
    }
    if (seen.has(currency.data)) {
      throw new Error(`more than one ${currency.data} row in aggregate`)
    }
    seen.add(currency.data)
    out[currency.data] = tokenAmountSchema.parse(row.amount)
  }
  return out
}
