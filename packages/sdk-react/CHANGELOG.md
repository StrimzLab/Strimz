# @strimz/sdk-react

## 0.1.13

### Patch Changes

- Updated dependencies [2f573b1]
- Updated dependencies [6c98c1a]
  - @strimz/shared-types@0.10.0
  - @strimz/sdk@0.9.0

## 0.1.12

### Patch Changes

- Updated dependencies [5713650]
- Updated dependencies [aa97e01]
  - @strimz/sdk@0.8.0
  - @strimz/shared-types@0.9.0

## 0.1.11

### Patch Changes

- Updated dependencies [b161025]
  - @strimz/shared-types@0.8.0
  - @strimz/sdk@0.7.1

## 0.1.10

### Patch Changes

- Updated dependencies [9d91ad2]
  - @strimz/shared-types@0.7.0
  - @strimz/sdk@0.7.0

## 0.1.9

### Patch Changes

- Updated dependencies [f2d773f]
  - @strimz/shared-types@0.6.0
  - @strimz/sdk@0.6.0

## 0.1.8

### Patch Changes

- Updated dependencies [ebc873b]
  - @strimz/shared-types@0.5.0
  - @strimz/sdk@0.5.0

## 0.1.7

### Patch Changes

- Updated dependencies [3a4c07e]
  - @strimz/shared-types@0.4.0
  - @strimz/sdk@0.4.0

## 0.1.6

### Patch Changes

- Updated dependencies [bd6fc8d]
  - @strimz/shared-types@0.3.2
  - @strimz/sdk@0.3.2

## 0.1.5

### Patch Changes

- Updated dependencies [6fed14f]
  - @strimz/shared-types@0.3.1
  - @strimz/sdk@0.3.1

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
