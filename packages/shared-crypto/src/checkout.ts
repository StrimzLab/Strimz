import { encodeAbiParameters, keccak256, type Hex } from 'viem'

export const CHECKOUT_PAYMENT_NONCE_DOMAIN = 'strimz.checkout.payment-nonce.v1'

export function checkoutPaymentNonce(sessionId: string): Hex {
  if (sessionId.length === 0) {
    throw new Error('checkoutPaymentNonce requires a non-empty session id')
  }
  return keccak256(
    encodeAbiParameters(
      [{ type: 'string' }, { type: 'string' }],
      [CHECKOUT_PAYMENT_NONCE_DOMAIN, sessionId],
    ),
  )
}
