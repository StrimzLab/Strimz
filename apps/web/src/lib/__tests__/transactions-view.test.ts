import { describe, expect, it } from 'vitest'
import type { Transaction } from '@strimz/shared-types'

import { canRefund, transactionKindLabel } from '@/lib/transactions-view'

const tx = (over: Partial<Transaction>): Transaction =>
  ({ id: 'cmtx1', kind: 'one_shot', status: 'confirmed', ...over }) as Transaction

describe('canRefund', () => {
  it.each(['one_shot', 'subscription_charge', 'invoice_payment', 'storefront_purchase'] as const)(
    'allows a confirmed %s',
    (kind) => {
      expect(canRefund(tx({ kind }))).toBe(true)
    },
  )

  it('refuses a refund transaction', () => {
    expect(canRefund(tx({ kind: 'refund' }))).toBe(false)
  })

  it.each(['pending', 'failed'] as const)('refuses a %s transaction', (status) => {
    expect(canRefund(tx({ status }))).toBe(false)
  })
})

describe('transactionKindLabel', () => {
  it('names every kind', () => {
    expect(transactionKindLabel('one_shot')).toBe('Payment')
    expect(transactionKindLabel('subscription_charge')).toBe('Subscription charge')
    expect(transactionKindLabel('refund')).toBe('Refund')
    expect(transactionKindLabel('invoice_payment')).toBe('Invoice payment')
    expect(transactionKindLabel('storefront_purchase')).toBe('Storefront purchase')
  })
})
