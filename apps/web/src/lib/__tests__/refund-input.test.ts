import { describe, expect, it } from 'vitest'

import { buildRefundInput } from '@/lib/refund-input'

const base = {
  transactionId: 'cmtx1',
  amount: '12.5',
  currency: 'EURC' as const,
  maxAmount: '20000000',
  reason: 'customer_request' as const,
  note: '',
}

describe('buildRefundInput', () => {
  it('builds the request in the transaction currency base units', () => {
    expect(buildRefundInput(base)).toEqual({
      ok: true,
      input: { transactionId: 'cmtx1', amount: '12500000', reason: 'customer_request' },
    })
  })

  it('trims the id and keeps a note', () => {
    expect(
      buildRefundInput({ ...base, transactionId: '  cmtx1 ', note: ' late delivery ' }),
    ).toEqual({
      ok: true,
      input: {
        transactionId: 'cmtx1',
        amount: '12500000',
        reason: 'customer_request',
        note: 'late delivery',
      },
    })
  })

  it('allows the full transaction amount', () => {
    expect(buildRefundInput({ ...base, amount: '20' }).ok).toBe(true)
  })

  it.each([
    ['', 'Enter the amount to refund'],
    ['abc', 'Enter a valid amount'],
    ['0', 'Enter an amount above 0'],
    ['-1', 'Enter a valid amount'],
    ['0.0000001', 'Enter at most 6 decimal places'],
  ])('refuses the amount %j', (amount, error) => {
    expect(buildRefundInput({ ...base, amount })).toEqual({ ok: false, error })
  })

  it('refuses more than the transaction amount, in its currency', () => {
    expect(buildRefundInput({ ...base, amount: '20.01' })).toEqual({
      ok: false,
      error: 'Enter at most 20 EURC, the transaction amount',
    })
  })

  it.each(['', 'bad id;'])('refuses the transaction id %j', (transactionId) => {
    expect(buildRefundInput({ ...base, transactionId })).toEqual({
      ok: false,
      error: 'Enter the original transaction ID',
    })
  })

  it('skips the upper bound when the transaction amount is unknown', () => {
    expect(buildRefundInput({ ...base, maxAmount: null, amount: '500' }).ok).toBe(true)
  })
})
