import { describe, expect, it } from 'vitest'
import { encodeAbiParameters, keccak256 } from 'viem'
import { checkoutPaymentNonce } from '@strimz/shared-crypto/checkout'

describe('checkoutPaymentNonce as the relay enforces it', () => {
  it('matches the vector the checkout signs with', () => {
    expect(checkoutPaymentNonce('cmsession0000000000000001')).toBe(
      '0xe7d4524532bd21406cdb2577ff76a8b28b64b9a7e46cb5bcf53ca5f6e8c54ef7',
    )
  })

  it('is keccak256(abi.encode(domain, sessionId))', () => {
    const expected = keccak256(
      encodeAbiParameters(
        [{ type: 'string' }, { type: 'string' }],
        ['strimz.checkout.payment-nonce.v1', 'ps_any'],
      ),
    )
    expect(checkoutPaymentNonce('ps_any')).toBe(expected)
  })
})
