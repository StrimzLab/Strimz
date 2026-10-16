import { describe, expect, it } from 'vitest'

import { buildPaymentSessionInput } from '@/lib/payment-session-input'

const base = {
  amount: '25',
  currency: 'USDC' as const,
  description: '',
  customerEmail: '',
  expiresInMinutes: '',
  successUrl: '',
  cancelUrl: '',
}

describe('buildPaymentSessionInput', () => {
  it('builds the smallest request with a 30 minute expiry', () => {
    expect(buildPaymentSessionInput(base)).toEqual({
      ok: true,
      input: { amount: '25000000', currency: 'USDC', expiresInMinutes: 30 },
    })
  })

  it('keeps every optional field that is filled in, trimmed', () => {
    expect(
      buildPaymentSessionInput({
        ...base,
        amount: '1.5',
        currency: 'EURC',
        description: '  Annual licence ',
        customerEmail: ' buyer@acme.test ',
        expiresInMinutes: '120',
        successUrl: 'https://acme.test/thanks',
        cancelUrl: 'http://acme.test/cart',
      }),
    ).toEqual({
      ok: true,
      input: {
        amount: '1500000',
        currency: 'EURC',
        description: 'Annual licence',
        customer: { email: 'buyer@acme.test' },
        expiresInMinutes: 120,
        successUrl: 'https://acme.test/thanks',
        cancelUrl: 'http://acme.test/cart',
      },
    })
  })

  it.each([
    ['', 'Enter an amount'],
    ['abc', 'Enter a valid amount'],
    ['1.0000001', 'Enter at most 6 decimal places'],
    ['0.99', 'Enter at least 1 USDC'],
  ])('refuses the amount %j', (amount, error) => {
    expect(buildPaymentSessionInput({ ...base, amount })).toEqual({ ok: false, error })
  })

  it('accepts exactly the minimum', () => {
    expect(buildPaymentSessionInput({ ...base, amount: '1' }).ok).toBe(true)
  })

  it.each(['0', '1441', '1.5', 'soon'])('refuses the expiry %j', (expiresInMinutes) => {
    expect(buildPaymentSessionInput({ ...base, expiresInMinutes })).toEqual({
      ok: false,
      error: 'Expiry must be a whole number of minutes from 1 to 1440',
    })
  })

  it('refuses a malformed customer email', () => {
    expect(buildPaymentSessionInput({ ...base, customerEmail: 'not-an-email' })).toEqual({
      ok: false,
      error: 'Enter a valid customer email',
    })
  })

  it.each([
    ['successUrl', 'javascript:alert(1)'],
    ['successUrl', 'ftp://acme.test'],
    ['cancelUrl', 'acme.test/cart'],
  ])('refuses %s %j', (field, value) => {
    expect(buildPaymentSessionInput({ ...base, [field]: value })).toEqual({
      ok: false,
      error: `${field === 'successUrl' ? 'Success' : 'Cancel'} URL must start with http:// or https://`,
    })
  })

  it('refuses a description over 500 characters', () => {
    expect(buildPaymentSessionInput({ ...base, description: 'x'.repeat(501) })).toEqual({
      ok: false,
      error: 'Description must be 500 characters or fewer',
    })
  })
})
