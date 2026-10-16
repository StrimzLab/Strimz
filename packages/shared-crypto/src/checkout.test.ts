import { describe, expect, it } from 'vitest'
import { checkoutPaymentNonce } from './checkout.js'

describe('checkout/checkoutPaymentNonce', () => {
  it('matches the published vector', () => {
    expect(checkoutPaymentNonce('cmsession0000000000000001')).toBe(
      '0xe7d4524532bd21406cdb2577ff76a8b28b64b9a7e46cb5bcf53ca5f6e8c54ef7',
    )
  })

  it('is a 32-byte hex value that differs per session', () => {
    const a = checkoutPaymentNonce('cmsession0000000000000001')
    const b = checkoutPaymentNonce('cmsession0000000000000002')
    expect(a).toMatch(/^0x[0-9a-f]{64}$/u)
    expect(a).not.toBe(b)
  })

  it('is stable across calls for one session', () => {
    expect(checkoutPaymentNonce('ps_abc')).toBe(checkoutPaymentNonce('ps_abc'))
  })

  it('rejects an empty session id', () => {
    expect(() => checkoutPaymentNonce('')).toThrow(/non-empty/)
  })
})
