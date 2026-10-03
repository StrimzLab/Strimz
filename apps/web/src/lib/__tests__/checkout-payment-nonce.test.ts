import { describe, expect, it } from 'vitest'
import { checkoutPaymentNonce } from '@strimz/shared-crypto/checkout'

describe('checkoutPaymentNonce as the checkout signs it', () => {
  it('matches the vector the relay enforces', () => {
    expect(checkoutPaymentNonce('cmsession0000000000000001')).toBe(
      '0xe7d4524532bd21406cdb2577ff76a8b28b64b9a7e46cb5bcf53ca5f6e8c54ef7',
    )
  })
})
