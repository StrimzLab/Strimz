import {
  paymentCurrencies,
  paymentCurrencySchema,
  tokenAmountSchema,
  type CurrencyAmounts,
  type PaymentCurrency,
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

export function currenciesToShow(active: ReadonlySet<PaymentCurrency>): PaymentCurrency[] {
  const shown = paymentCurrencies.filter((c) => active.has(c))
  return shown.length > 0 ? shown : ['USDC']
}

export function formatAmount(raw: bigint | string, currency: PaymentCurrency): string {
  const value = BigInt(raw)
  const sign = value < 0n ? '-' : ''
  const abs = value < 0n ? -value : value
  const whole = abs / 1_000_000n
  const frac = (abs % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '')
  return `${sign}${frac.length === 0 ? whole.toString() : `${whole}.${frac}`} ${currency}`
}
