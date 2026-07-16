# @strimz/sdk

## 0.3.0

### Minor Changes

- 52c8b7b: Add a subscription-status check to the hosted checkout so a wallet can't enrol into the same plan twice. Adds `checkout.subscriptionStatus(planId, payer)` on the browser client and the `SubscriptionStatusResult` type, both backed by the public `GET /v1/checkout/plans/:id/subscription` endpoint.

### Patch Changes

- Updated dependencies [52c8b7b]
  - @strimz/shared-types@0.3.0

## 0.2.1

### Patch Changes

- 15e8de3: Point SDK defaults at the real domain. `@strimz/sdk` API base URL default is now `https://api.strimz.finance`. `@strimz/sdk-react` `checkoutOrigin` default is the bare `https://strimz.finance` origin — the payment-checkout primitives (`useStrimzCheckout`, `StrimzPayButton`, `StrimzCheckoutEmbed`) append `/pay/{sessionId}` themselves, and the postMessage origin check derives the bare origin so it stays correct even when a path-bearing origin is supplied. Subscriptions continue to use the separate `/sub/{planId}` link flow.

## 0.2.0

### Minor Changes

- 832c104: Add EIP-712 typed-data intent builders (pay + subscription) to the SDK, with the supporting Zod schemas and inferred types.

### Patch Changes

- Updated dependencies [832c104]
  - @strimz/shared-types@0.2.0

## 0.1.1

### Patch Changes

- b1fbded: Standardise README layout and badges. Drop monorepo-internal references and external SDK comparisons from public-facing prose and source comments. No API or behaviour changes.
- Updated dependencies [b1fbded]
  - @strimz/shared-config@0.1.1
  - @strimz/shared-crypto@0.1.1
  - @strimz/shared-types@0.1.1
