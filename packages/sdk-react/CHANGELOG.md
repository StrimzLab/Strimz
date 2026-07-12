# @strimz/sdk-react

## 0.1.4

### Patch Changes

- Updated dependencies [52c8b7b]
  - @strimz/shared-types@0.3.0
  - @strimz/sdk@0.3.0

## 0.1.3

### Patch Changes

- 15e8de3: Point SDK defaults at the real domain. `@strimz/sdk` API base URL default is now `https://api.strimz.finance`. `@strimz/sdk-react` `checkoutOrigin` default is the bare `https://strimz.finance` origin — the payment-checkout primitives (`useStrimzCheckout`, `StrimzPayButton`, `StrimzCheckoutEmbed`) append `/pay/{sessionId}` themselves, and the postMessage origin check derives the bare origin so it stays correct even when a path-bearing origin is supplied. Subscriptions continue to use the separate `/sub/{planId}` link flow.
- Updated dependencies [15e8de3]
  - @strimz/sdk@0.2.1

## 0.1.2

### Patch Changes

- Updated dependencies [832c104]
  - @strimz/sdk@0.2.0
  - @strimz/shared-types@0.2.0

## 0.1.1

### Patch Changes

- b1fbded: Standardise README layout and badges. Drop monorepo-internal references and external SDK comparisons from public-facing prose and source comments. No API or behaviour changes.
- Updated dependencies [b1fbded]
  - @strimz/sdk@0.1.1
  - @strimz/shared-config@0.1.1
  - @strimz/shared-types@0.1.1
