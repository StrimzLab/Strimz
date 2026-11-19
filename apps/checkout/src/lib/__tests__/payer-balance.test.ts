import { describe, expect, it } from 'vitest'

import { payerBalance } from '../payer-balance'
import { PAYER_MESSAGES, payerError } from '../payer-errors'

// An empty wallet saw "This checkout isn't available right now" (#487).
describe('payerBalance', () => {
  const due = 1_000_000n

  it('waits while the balance is loading', () => {
    expect(payerBalance({ balance: undefined, amount: due, decimals: 6, symbol: 'USDC' })).toEqual({
      state: 'unknown',
      message: null,
    })
  })

  it('blocks payment and says how much is missing', () => {
    expect(payerBalance({ balance: 0n, amount: due, decimals: 6, symbol: 'USDC' })).toEqual({
      state: 'short',
      message: 'This wallet has 0.00 USDC. Add 1.00 USDC to pay.',
    })
    expect(
      payerBalance({ balance: 400_000n, amount: due, decimals: 6, symbol: 'EURC' }).message,
    ).toBe('This wallet has 0.40 EURC. Add 0.60 EURC to pay.')
  })

  it('allows payment when the balance covers the amount', () => {
    expect(payerBalance({ balance: due, amount: due, decimals: 6, symbol: 'USDC' })).toEqual({
      state: 'enough',
      message: null,
    })
  })
})

describe('payerError for an empty wallet', () => {
  it('names the balance problem instead of calling the checkout unavailable', () => {
    const e = payerError({
      raw: PAYER_MESSAGES.insufficient_balance_payment ?? null,
      phase: 'failed',
      submitted: false,
    })
    expect(e.title).not.toMatch(/isn't available/u)
    expect(e.detail).toMatch(/not enough/u)
  })
})
