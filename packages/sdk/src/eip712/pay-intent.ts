import type { Eip712TypedData } from './types.js'

/**
 * Inputs for the Strimz PayIntent. Payer signs this alongside the
 * EIP-3009 auth. Without it, a valid auth sig can be redirected to
 * pay a different merchant.
 *
 * Every field must match the corresponding argument the API will
 * submit on-chain — the contract compares them via ecrecover.
 */
export interface PayIntentParams {
  chainId: number
  verifyingContract: `0x${string}`
  merchantId: bigint
  token: `0x${string}`
  amount: bigint
  nonce: `0x${string}`
  validBefore: bigint
  ref: `0x${string}`
}

/** Field order matches `PAY_INTENT_TYPEHASH` in `StrimzPayments.sol`. */
export const PAY_INTENT_TYPES = {
  PayIntent: [
    { name: 'merchantId', type: 'uint256' },
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'ref', type: 'bytes32' },
  ],
} as const

/** Domain name + version mirror `EIP712("StrimzPayments", "1")`. */
export function buildPayIntentTypedData(params: PayIntentParams): Eip712TypedData<'PayIntent'> {
  return {
    domain: {
      name: 'StrimzPayments',
      version: '1',
      chainId: params.chainId,
      verifyingContract: params.verifyingContract,
    },
    types: PAY_INTENT_TYPES,
    primaryType: 'PayIntent',
    message: {
      merchantId: params.merchantId,
      token: params.token,
      amount: params.amount,
      nonce: params.nonce,
      validBefore: params.validBefore,
      ref: params.ref,
    },
  }
}
