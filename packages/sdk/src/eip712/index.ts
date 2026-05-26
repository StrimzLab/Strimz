/**
 * EIP-712 typed-data builders.
 *
 * Pure functions with no wallet dependency. The returned shape matches
 * the EIP-712 standard and is accepted by every major wallet library:
 *
 *   import { buildReceiveWithAuthorizationTypedData } from '@strimz/sdk/eip712'
 *
 *   const typedData = buildReceiveWithAuthorizationTypedData({ ... })
 *   const signature = await walletClient.signTypedData(typedData)
 *
 * The builders are deliberately granular (one per primitive: EIP-3009,
 * EIP-2612) so the SDK can support future schemes (e.g. x402 batched
 * payments) by adding a sibling builder without touching existing
 * call sites.
 */
export type { Eip712Domain, Eip712Field, Eip712Types, Eip712TypedData } from './types.js'

export {
  buildReceiveWithAuthorizationTypedData,
  RECEIVE_WITH_AUTHORIZATION_TYPES,
  type ReceiveWithAuthorizationParams,
} from './receive-with-authorization.js'

export { buildPermitTypedData, PERMIT_TYPES, type PermitParams } from './permit.js'
