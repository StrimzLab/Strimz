import type { Eip712TypedData } from './types.js'

export interface ViewSubscriptionsParams {
  chainId: number
  payer: `0x${string}`
  issuedAt: bigint
}

export const VIEW_SUBSCRIPTIONS_TYPES = {
  ViewSubscriptions: [
    { name: 'payer', type: 'address' },
    { name: 'issuedAt', type: 'uint256' },
  ],
} as const

export const VIEW_SUBSCRIPTIONS_VALIDITY_SECONDS = 600

/** Proves a wallet owns the address whose subscriptions it asks to see. Costs no gas. */
export function buildViewSubscriptionsTypedData(
  params: ViewSubscriptionsParams,
): Eip712TypedData<'ViewSubscriptions'> {
  return {
    domain: { name: 'Strimz', version: '1', chainId: params.chainId },
    types: VIEW_SUBSCRIPTIONS_TYPES,
    primaryType: 'ViewSubscriptions',
    message: { payer: params.payer, issuedAt: params.issuedAt },
  }
}
