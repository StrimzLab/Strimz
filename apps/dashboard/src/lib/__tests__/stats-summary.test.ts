import { describe, expect, it } from 'vitest'
import { statsSummarySchema, type StatsSummary } from '@strimz/shared-types'
import {
  customerCards,
  forecastAmounts,
  forecastConfidenceNote,
  homeCards,
  invoiceCards,
  paymentSessionCards,
  refundCards,
  subscriptionCards,
  summaryValue,
} from '../stats-summary'

const zero = { USDC: '0', EURC: '0' }

const summary: StatsSummary = statsSummarySchema.parse({
  mode: 'test',
  generatedAt: '2026-10-03T12:00:00.000Z',
  volume: {
    last7d: {
      count: 2,
      gross: { USDC: '10000000', EURC: '3000000' },
      fees: { USDC: '100000', EURC: '30000' },
      net: { USDC: '9900000', EURC: '2970000' },
    },
    last30d: {
      count: 3,
      gross: { USDC: '30000000', EURC: '0' },
      fees: zero,
      net: zero,
    },
    allTime: { count: 4, gross: { USDC: '30000000', EURC: '7000000' }, fees: zero, net: zero },
  },
  paymentSessions: {
    total: 250,
    byStatus: {
      created: 40,
      awaiting_payment: 5,
      submitted: 5,
      confirmed: 150,
      failed: 10,
      expired: 30,
      cancelled: 10,
    },
    confirmed: { count: 150, amount: { USDC: '1500000000', EURC: '250000000' } },
  },
  invoices: {
    byStatus: { draft: 1, sent: 120, paid: 2, overdue: 2, void: 0 },
    outstanding: { count: 122, amount: { USDC: '105000000', EURC: '40000000' } },
    overdue: { count: 2, amount: { USDC: '5000000', EURC: '40000000' } },
    paidLast30d: { count: 1, amount: { USDC: '12000000', EURC: '0' } },
  },
  refunds: {
    byStatus: {
      pending: 0,
      awaiting_signature: 1,
      submitted: 0,
      completed: 2,
      failed: 1,
      cancelled: 0,
    },
    completed: { count: 2, amount: { USDC: '2000000', EURC: '1000000' } },
  },
  subscriptions: {
    total: 4,
    byStatus: { trialing: 1, active: 2, at_risk: 0, paused: 0, cancelled: 1, lapsed: 0 },
  },
  customers: { total: 1234 },
})

describe('stats summary cards', () => {
  it('maps the home cards from server totals, not loaded rows', () => {
    expect(homeCards(summary)).toEqual({
      volume7d: '10 USDC · 3 EURC',
      volume7dNote: '2 confirmed',
      volume30d: '30 USDC',
      openInvoices: '122',
      anyConfirmedAtAll: true,
    })
  })

  it('maps the payment session cards', () => {
    expect(paymentSessionCards(summary.paymentSessions)).toEqual({
      total: '250',
      confirmed: '1500 USDC · 250 EURC',
      confirmedNote: '150 sessions',
      inFlight: '50',
      conversion: '60%',
    })
  })

  it('maps the invoice cards', () => {
    expect(invoiceCards(summary.invoices)).toEqual({
      outstanding: '105 USDC · 40 EURC',
      outstandingNote: '122 invoices',
      paidLast30d: '12 USDC',
      paidLast30dNote: '1 invoice',
      overdueCount: 2,
      overdue: '2',
      overdueNote: '5 USDC · 40 EURC',
    })
  })

  it('maps the refund cards', () => {
    expect(refundCards(summary.refunds)).toEqual({
      completed: '2 USDC · 1 EURC',
      completedNote: '2 refunds',
      awaitingSignature: '1',
      failedCount: 1,
      failed: '1',
    })
  })

  it('maps the subscription and customer cards', () => {
    expect(subscriptionCards(summary.subscriptions)).toEqual({
      active: '2',
      at_risk: '0',
      trialing: '1',
      lapsed: '0',
    })
    expect(customerCards(summary.customers)).toEqual({ total: '1,234' })
  })

  it('shows a dash while loading and says so when the summary failed', () => {
    const pick = (s: StatsSummary) => s.customers.total.toString()
    expect(summaryValue({ data: summary, isError: false }, pick)).toBe('1234')
    expect(summaryValue<StatsSummary>({ data: undefined, isError: false }, pick)).toBe('—')
    expect(summaryValue<StatsSummary>({ data: undefined, isError: true }, pick)).toBe('Unavailable')
  })
})

describe('forecast cards', () => {
  const low = {
    confidence: 'low' as const,
    last90DayRevenue: '0',
    next30: '0',
    next60: '0',
    next90: '0',
  }
  it('keeps each currency on its own and names the confidence of currencies with revenue', () => {
    const forecast = {
      byCurrency: {
        USDC: {
          confidence: 'medium' as const,
          last90DayRevenue: '90000000',
          next30: '30000000',
          next60: '60000000',
          next90: '90000000',
        },
        EURC: low,
      },
    }
    expect(forecastAmounts(forecast, 'next60')).toEqual({ USDC: '60000000', EURC: '0' })
    expect(forecastConfidenceNote(forecast)).toBe('USDC medium confidence')
    expect(forecastConfidenceNote({ byCurrency: { USDC: low, EURC: low } })).toBe('low confidence')
  })
})
