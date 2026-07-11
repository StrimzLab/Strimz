/**
 * EIP-712 typed-data builders. Pure functions; no wallet dependency.
 *
 * Meta-tx flows need TWO signatures — one for the token
 * (`ReceiveWithAuthorization` or `Permit`) and one Strimz intent
 * (`PayIntent` or `SubscriptionIntent`) that binds the money-routing
 * fields the token never sees.
 */
export type { Eip712Domain, Eip712Field, Eip712Types, Eip712TypedData } from './types.js'

export {
  buildReceiveWithAuthorizationTypedData,
  RECEIVE_WITH_AUTHORIZATION_TYPES,
  type ReceiveWithAuthorizationParams,
} from './receive-with-authorization.js'

export { buildPermitTypedData, PERMIT_TYPES, type PermitParams } from './permit.js'

export { buildPayIntentTypedData, PAY_INTENT_TYPES, type PayIntentParams } from './pay-intent.js'

export {
  buildSubscriptionIntentTypedData,
  SUBSCRIPTION_INTENT_TYPES,
  type SubscriptionIntentParams,
} from './subscription-intent.js'
