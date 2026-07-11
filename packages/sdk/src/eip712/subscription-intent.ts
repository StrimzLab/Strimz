import type { Eip712TypedData } from './types.js'

/**
 * Inputs for the Strimz SubscriptionIntent. Payer signs this
 * alongside the ERC-2612 permit. Without it, a valid permit can be
 * used to enrol the payer in a plan they never picked.
 *
 * `permitDeadline` ties this intent to the accompanying permit —
 * they expire together.
 */
export interface SubscriptionIntentParams {
  chainId: number
  verifyingContract: `0x${string}`
  merchantId: bigint
  token: `0x${string}`
  amount: bigint
  interval: number
  startAt: bigint
  endAt: bigint
  permitDeadline: bigint
}

/** Field order matches `SUBSCRIPTION_INTENT_TYPEHASH` in the contract. */
export const SUBSCRIPTION_INTENT_TYPES = {
  SubscriptionIntent: [
    { name: 'merchantId', type: 'uint256' },
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'interval', type: 'uint32' },
    { name: 'startAt', type: 'uint64' },
    { name: 'endAt', type: 'uint64' },
    { name: 'permitDeadline', type: 'uint256' },
  ],
} as const

/** Domain mirrors `EIP712("StrimzSubscriptions", "1")`. */
export function buildSubscriptionIntentTypedData(
  params: SubscriptionIntentParams,
): Eip712TypedData<'SubscriptionIntent'> {
  return {
    domain: {
      name: 'StrimzSubscriptions',
      version: '1',
      chainId: params.chainId,
      verifyingContract: params.verifyingContract,
    },
    types: SUBSCRIPTION_INTENT_TYPES,
    primaryType: 'SubscriptionIntent',
    message: {
      merchantId: params.merchantId,
      token: params.token,
      amount: params.amount,
      interval: params.interval,
      startAt: params.startAt,
      endAt: params.endAt,
      permitDeadline: params.permitDeadline,
    },
  }
}
