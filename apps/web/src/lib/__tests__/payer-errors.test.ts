import { describe, expect, it } from 'vitest'
import {
  PAYER_MESSAGES,
  PAYER_REFUSALS,
  attachError,
  payerError,
  storefrontCheckoutError,
} from '@/lib/payer-errors'

const RAW_FROM_AUDIT = [
  'session has no token address configured. Set ARC_USDC_ADDRESS on the API',
  'plan has no token address configured. Set ARC_USDC_ADDRESS on the API',
  'wallet not connected',
  'NEXT_PUBLIC_STRIMZ_PAYMENTS_ADDRESS is not configured',
  'NEXT_PUBLIC_STRIMZ_SUBSCRIPTIONS_ADDRESS is not configured',
  'USDC does not support EIP-3009. Fall back to approve+pay flow.',
  'USDC does not support EIP-2612. Fall back to approve+create flow.',
  'expected 65-byte signature hex, got 10 chars',
  'submission status poll timed out',
  'submission status check failed (403)',
  'unexpected server error',
  'Failed to fetch',
]

const DEVELOPER_WORDS =
  /NEXT_PUBLIC|ARC_USDC|EIP-|signature|on-chain|onchain|poll|hex|submission|API/u

function text(e: { title: string; detail: string }) {
  return `${e.title} ${e.detail}`
}

describe('payerError', () => {
  it.each(RAW_FROM_AUDIT)('never shows developer text for %s', (raw) => {
    for (const submitted of [false, true]) {
      const e = payerError({ raw, phase: 'failed', submitted, merchantName: 'Acme' })
      expect(text(e)).not.toMatch(DEVELOPER_WORDS)
    }
    const load = payerError({ raw, phase: 'load_error', submitted: false, merchantName: 'Acme' })
    expect(text(load)).not.toMatch(DEVELOPER_WORDS)
  })

  it('says nothing was charged when the payer cancels in the wallet', () => {
    const e = payerError({
      raw: 'User rejected the request.\n\nRequest Arguments: …',
      phase: 'failed',
      submitted: false,
    })
    expect(e.title).toBe('You cancelled in your wallet')
    expect(e.detail).toBe('Nothing was charged.')
    expect(e.action).toBe('retry')
  })

  it('keeps the known relay messages word for word', () => {
    for (const message of Object.values(PAYER_MESSAGES)) {
      expect(payerError({ raw: message, phase: 'failed', submitted: false }).detail).toBe(message)
    }
  })

  it('never says nothing was charged once the payment was sent', () => {
    const e = payerError({
      raw: 'submission status check failed (403)',
      phase: 'failed',
      submitted: true,
      merchantName: 'Acme',
    })
    expect(text(e)).not.toContain('Nothing was charged')
    expect(e.detail).toContain("Don't pay again")
    expect(e.action).toBe('refresh')
  })

  it('tells a payer who waited too long not to pay again', () => {
    const e = payerError({
      raw: 'submission status poll timed out',
      phase: 'failed',
      submitted: true,
    })
    expect(e.title).toBe('This is taking longer than usual')
    expect(e.detail).toContain("Don't pay again")
    expect(e.action).toBe('refresh')
  })

  it('says a reverted payment charged nothing and names the merchant', () => {
    const e = payerError({ raw: null, phase: 'reverted', submitted: true, merchantName: 'Acme' })
    expect(e.title).toBe("The payment didn't go through")
    expect(e.detail).toContain('Nothing was charged')
    expect(e.detail).toContain('Acme')
  })

  it('treats setup faults as an unavailable checkout', () => {
    const e = payerError({
      raw: 'NEXT_PUBLIC_STRIMZ_PAYMENTS_ADDRESS is not configured',
      phase: 'failed',
      submitted: false,
    })
    expect(e.title).toBe("This checkout isn't available right now")
    expect(e.detail).toContain('the merchant')
  })
})

describe('attachError', () => {
  it('keeps the known refusals', () => {
    for (const message of Object.values(PAYER_REFUSALS)) {
      expect(attachError(message)).toBe(message)
    }
  })

  it('hides a raw status code', () => {
    expect(attachError('Attach payer failed (500)')).toBe("We couldn't save your email. Try again.")
  })
})

describe('storefrontCheckoutError', () => {
  it('names a sold-out product', () => {
    expect(storefrontCheckoutError('sold_out')).toBe('This product just sold out.')
  })

  it('names a product that has gone', () => {
    expect(storefrontCheckoutError('not_found')).toBe('This product is no longer available.')
  })

  it.each([null, 'invalid_request', 'internal'])('falls back to a plain retry for %s', (code) => {
    expect(storefrontCheckoutError(code)).toBe("We couldn't open checkout. Try again.")
  })
})
