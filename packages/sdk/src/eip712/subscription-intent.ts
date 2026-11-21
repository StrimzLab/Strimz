import type { Eip712TypedData } from './types.js'

/**
 * Inputs for the Strimz SubscriptionIntent. Payer signs this
 * alongside the ERC-2612 permit. Without it, a valid permit can be
 * used to enrol the payer in a plan they never picked.
 *
 * `permitDeadline` and `permitValue` tie this intent to the accompanying
 * permit. `nonce` is spent once on chain; the Strimz API only accepts
 * `subscriptionIntentNonce(planId, payer, the token's permit nonce)` from
 * `@strimz/shared-crypto`, so a retried signup can't enrol twice.
 */
export interface SubscriptionIntentParams {
  chainId: number
  verifyingContract: `0x${string}`
  /** The paying wallet. It's signed in, so one signature can't enrol a sibling wallet. */
  payer: `0x${string}`
  merchantId: bigint
  token: `0x${string}`
  amount: bigint
  interval: number
  startAt: bigint
  endAt: bigint
  permitDeadline: bigint
  permitValue: bigint
  nonce: `0x${string}`
}

/** Field order matches `SUBSCRIPTION_INTENT_TYPEHASH` in the contract. */
export const SUBSCRIPTION_INTENT_TYPES = {
  SubscriptionIntent: [
    { name: 'payer', type: 'address' },
    { name: 'merchantId', type: 'uint256' },
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'interval', type: 'uint32' },
    { name: 'startAt', type: 'uint64' },
    { name: 'endAt', type: 'uint64' },
    { name: 'permitDeadline', type: 'uint256' },
    { name: 'permitValue', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
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
      payer: params.payer,
      merchantId: params.merchantId,
      token: params.token,
      amount: params.amount,
      interval: params.interval,
      startAt: params.startAt,
      endAt: params.endAt,
      permitDeadline: params.permitDeadline,
      permitValue: params.permitValue,
      nonce: params.nonce,
    },
  }
}

export interface CancelSubscriptionParams {
  chainId: number
  verifyingContract: `0x${string}`
  subscriptionId: bigint
  deadline: bigint
}

/** Field order matches `CANCEL_SUBSCRIPTION_TYPEHASH` in the contract. */
export const CANCEL_SUBSCRIPTION_TYPES = {
  CancelSubscription: [
    { name: 'subscriptionId', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const

/** What a payer signs so Strimz can cancel for them with `cancelWithSig`. */
export function buildCancelSubscriptionTypedData(
  params: CancelSubscriptionParams,
): Eip712TypedData<'CancelSubscription'> {
  return {
    domain: {
      name: 'StrimzSubscriptions',
      version: '1',
      chainId: params.chainId,
      verifyingContract: params.verifyingContract,
    },
    types: CANCEL_SUBSCRIPTION_TYPES,
    primaryType: 'CancelSubscription',
    message: { subscriptionId: params.subscriptionId, deadline: params.deadline },
  }
}
