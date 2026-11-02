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

export const SUBSCRIPTION_INTENT_NONCE_DOMAIN = 'strimz.subscription-intent-nonce.v1'

// The token's permit nonce only moves when a permit lands, so a re-sign while
// an enrolment is pending gets the same intent nonce and the contract rejects
// the duplicate.
export function subscriptionIntentNonce(planId: string, payer: Hex, permitNonce: bigint): Hex {
  if (planId.length === 0) {
    throw new Error('subscriptionIntentNonce requires a non-empty plan id')
  }
  return keccak256(
    encodeAbiParameters(
      [{ type: 'string' }, { type: 'string' }, { type: 'address' }, { type: 'uint256' }],
      [SUBSCRIPTION_INTENT_NONCE_DOMAIN, planId, payer.toLowerCase() as Hex, permitNonce],
    ),
  )
}
