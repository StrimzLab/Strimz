import { describe, expect, it } from 'vitest'
import { checkoutPaymentNonce, subscriptionIntentNonce } from './checkout.js'

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

describe('checkout/subscriptionIntentNonce', () => {
  const payer = '0x5555555555555555555555555555555555555555'

  it('matches the published vector', () => {
    expect(subscriptionIntentNonce('cmplan0000000000000001', payer, 7n)).toBe(
      '0x2d80b757304eaa9a00bc108190846917359b36a0e29bdef5b1ff5274646d9e00',
    )
  })

  it('ignores the case of the payer address', () => {
    const mixed = '0xAbCdEf0000000000000000000000000000000001'
    expect(subscriptionIntentNonce('plan', mixed, 0n)).toBe(
      subscriptionIntentNonce('plan', mixed.toLowerCase(), 0n),
    )
  })

  it('changes with the plan, the payer and the permit nonce', () => {
    const base = subscriptionIntentNonce('plan', payer, 0n)
    expect(subscriptionIntentNonce('plan2', payer, 0n)).not.toBe(base)
    expect(
      subscriptionIntentNonce('plan', '0x6666666666666666666666666666666666666666', 0n),
    ).not.toBe(base)
    expect(subscriptionIntentNonce('plan', payer, 1n)).not.toBe(base)
  })

  it('rejects an empty plan id', () => {
    expect(() => subscriptionIntentNonce('', payer, 0n)).toThrow(/non-empty/)
  })
})
