import { paymentCurrencies, type Mode, type PaymentCurrency } from '@strimz/shared-types'
import { tokenAmountToNumber } from './format'

export const MODE_OPTIONS: readonly { value: Mode; label: string }[] = [
  { value: 'live', label: 'Live' },
  { value: 'test', label: 'Test' },
]

export const CURRENCY_OPTIONS: readonly { value: PaymentCurrency; label: string }[] =
  paymentCurrencies.map((c) => ({ value: c, label: c }))

export interface AdminVolumeRow {
  day: string
  currency: PaymentCurrency
  volume: string
  fees: string
}

export type VolumePoint = { day: string } & Partial<Record<string, number | string>>

export function pivotVolumeByCurrency(rows: readonly AdminVolumeRow[]): {
  currencies: PaymentCurrency[]
  points: VolumePoint[]
} {
  const byDay = new Map<string, VolumePoint>()
  for (const row of rows) {
    const point = byDay.get(row.day) ?? { day: row.day }
    if (point[row.currency] !== undefined) {
      throw new Error(`more than one ${row.currency} volume row for ${row.day}`)
    }
    point[row.currency] = tokenAmountToNumber(row.volume)
    point[`${row.currency}_fees`] = tokenAmountToNumber(row.fees)
    byDay.set(row.day, point)
  }
  const currencies = paymentCurrencies.filter((c) => rows.some((r) => r.currency === c))
  const points = [...byDay.values()]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((point) => {
      const filled: VolumePoint = { ...point, day: point.day.slice(5) }
      for (const c of currencies) {
        filled[c] ??= 0
        filled[`${c}_fees`] ??= 0
      }
      return filled
    })
  return { currencies, points }
}
