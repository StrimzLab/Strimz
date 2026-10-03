# @strimz/sdk

## 0.5.0

### Minor Changes

- ebc873b: Add `subscriptionEnrolmentTermsSchema` and `StrimzBrowserClient.checkout.planTerms(planId, payer)`. The terms carry the `startAt` a payer must sign for a plan: the end of the plan's trial for a payer who has not subscribed to it before, otherwise `0`. `POST /v1/relay/subscriptions` with a `subscriptionInternalId` now rejects terms that differ from the plan with `enrolment_terms_mismatch`.

### Patch Changes

- Updated dependencies [ebc873b]
  - @strimz/shared-types@0.5.0

## 0.4.0

### Minor Changes

- 3a4c07e: `createStorefrontProductInputSchema` accepts an optional `planId`. Subscription products must carry one and one-time products must not; the API rejects a plan that does not belong to the merchant, is archived, or differs from the product in price, currency or interval. The storefront checkout now returns error code `sold_out` instead of `invalid_request` when a product has no stock left.

### Patch Changes

- Updated dependencies [3a4c07e]
  - @strimz/shared-types@0.4.0

## 0.3.2

### Patch Changes

- Updated dependencies [bd6fc8d]
  - @strimz/shared-types@0.3.2

## 0.3.1

### Patch Changes

- Updated dependencies [6fed14f]
  - @strimz/shared-crypto@0.1.2
  - @strimz/shared-types@0.3.1

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
