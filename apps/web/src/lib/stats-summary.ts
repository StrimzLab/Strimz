import {
  paymentCurrencies,
  type CurrencyAmounts,
  type StatsForecast,
  type StatsSummary,
} from '@strimz/shared-types'
import { formatCurrencyAmounts } from './currency-totals'

export const UNAVAILABLE = 'Unavailable'

export function summaryValue<T>(
  query: { data?: T; isError: boolean },
  pick: (data: T) => string,
): string {
  if (query.data !== undefined) return pick(query.data)
  return query.isError ? UNAVAILABLE : '—'
}

function count(n: number, noun: string): string {
  return `${n.toLocaleString()} ${noun}${n === 1 ? '' : 's'}`
}

export function homeCards(summary: StatsSummary) {
  return {
    volume7d: formatCurrencyAmounts(summary.volume.last7d.gross),
    volume7dNote: `${summary.volume.last7d.count.toLocaleString()} confirmed`,
    volume30d: formatCurrencyAmounts(summary.volume.last30d.gross),
    openInvoices: summary.invoices.outstanding.count.toLocaleString(),
    anyConfirmedAtAll: summary.volume.allTime.count > 0,
  }
}

export function paymentSessionCards(sessions: StatsSummary['paymentSessions']) {
  const { byStatus } = sessions
  const inFlight = byStatus.created + byStatus.awaiting_payment + byStatus.submitted
  const conversion =
    sessions.total === 0 ? 0 : Math.round((100 * byStatus.confirmed) / sessions.total)
  return {
    total: sessions.total.toLocaleString(),
    confirmed: formatCurrencyAmounts(sessions.confirmed.amount),
    confirmedNote: count(sessions.confirmed.count, 'session'),
    inFlight: inFlight.toLocaleString(),
    conversion: `${conversion}%`,
  }
}

export function invoiceCards(invoices: StatsSummary['invoices']) {
  return {
    outstanding: formatCurrencyAmounts(invoices.outstanding.amount),
    outstandingNote: count(invoices.outstanding.count, 'invoice'),
    paidLast30d: formatCurrencyAmounts(invoices.paidLast30d.amount),
    paidLast30dNote: count(invoices.paidLast30d.count, 'invoice'),
    overdueCount: invoices.overdue.count,
    overdue: invoices.overdue.count.toLocaleString(),
    overdueNote: formatCurrencyAmounts(invoices.overdue.amount),
  }
}

export function refundCards(refunds: StatsSummary['refunds']) {
  return {
    completed: formatCurrencyAmounts(refunds.completed.amount),
    completedNote: count(refunds.completed.count, 'refund'),
    awaitingSignature: refunds.byStatus.awaiting_signature.toLocaleString(),
    failedCount: refunds.byStatus.failed,
    failed: refunds.byStatus.failed.toLocaleString(),
  }
}

export const SUBSCRIPTION_CARD_STATUSES = ['active', 'at_risk', 'trialing', 'lapsed'] as const

export function subscriptionCards(
  subscriptions: StatsSummary['subscriptions'],
): Record<(typeof SUBSCRIPTION_CARD_STATUSES)[number], string> {
  const { byStatus } = subscriptions
  return {
    active: byStatus.active.toLocaleString(),
    at_risk: byStatus.at_risk.toLocaleString(),
    trialing: byStatus.trialing.toLocaleString(),
    lapsed: byStatus.lapsed.toLocaleString(),
  }
}

export function customerCards(customers: StatsSummary['customers']) {
  return { total: customers.total.toLocaleString() }
}

export function forecastAmounts(
  forecast: StatsForecast,
  horizon: 'next30' | 'next60' | 'next90',
): CurrencyAmounts {
  return { USDC: forecast.byCurrency.USDC[horizon], EURC: forecast.byCurrency.EURC[horizon] }
}

export function forecastConfidenceNote(forecast: StatsForecast): string {
  const withRevenue = paymentCurrencies.filter(
    (c) => forecast.byCurrency[c].last90DayRevenue !== '0',
  )
  if (withRevenue.length === 0) return 'low confidence'
  return withRevenue.map((c) => `${c} ${forecast.byCurrency[c].confidence} confidence`).join(' · ')
}
