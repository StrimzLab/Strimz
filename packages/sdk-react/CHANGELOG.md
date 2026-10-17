# @strimz/sdk-react

## 0.3.5

### Patch Changes

- Updated dependencies [3b52e35]
  - @strimz/shared-types@0.14.0
  - @strimz/shared-config@0.8.0
  - @strimz/sdk@0.12.0

## 0.3.4

### Patch Changes

- Updated dependencies [bfc7c45]
  - @strimz/sdk@0.11.0

## 0.3.3

### Patch Changes

- Updated dependencies [71fa746]
  - @strimz/sdk@0.10.4

## 0.3.2

### Patch Changes

- 7bc35a6: `checkoutOrigin` now defaults to `https://www.strimz.finance`, the host that serves the checkout. On 0.3.0 the default `https://strimz.finance` redirects to `www`, so `onSuccess` and `onError` never fired: upgrade, or pass `checkoutOrigin="https://www.strimz.finance"`. A `checkoutOrigin` with a path, query or hash now throws instead of building a broken checkout URL; a trailing slash is accepted.

## 0.3.1

### Patch Changes

- 8383481: READMEs now match what each package exports. `@strimz/sdk-react` no longer mentions TanStack Query, and documents `useStrimzSession` returning `{ session, loading, error, refresh }`. The `@strimz/sdk` README documents the browser client's `checkout` and `tokens` namespaces, all error classes and `@strimz/sdk/eip712`. No code changes.
- Updated dependencies [8383481]
  - @strimz/sdk@0.10.3
  - @strimz/shared-types@0.13.1
  - @strimz/shared-config@0.7.1

## 0.3.0

### Minor Changes

- 666bfdd: The popup and the embedded checkout now report their result. `onSuccess`, `onCancel` and `onError` fire for the first time, because the hosted checkout posts to the page that opened it (that page's origin goes in a new `parent` query parameter).
  - `@strimz/sdk-react`: a result is accepted only from the checkout origin, from the component's own popup or iframe, for the session it opened, and only if it matches the shared schema. `onError` receives a `StrimzCheckoutError` with `code` and `sessionId`. Closing the popup now fires `onCancel`, and `useStrimzSession` stops polling once the session is terminal. Earlier versions never receive a result.
  - `@strimz/shared-types`: adds `checkoutResultMessageSchema` and `checkoutResultErrorCodes`. `createPaymentSessionInputSchema` now rejects a `successUrl` or `cancelUrl` that is not `http(s)`, as the session schema already did.

### Patch Changes

- Updated dependencies [666bfdd]
  - @strimz/shared-types@0.13.0
  - @strimz/sdk@0.10.2

## 0.2.8

### Patch Changes

- Updated dependencies [efdb861]
  - @strimz/shared-config@0.7.0
  - @strimz/sdk@0.10.1
  - @strimz/shared-types@0.12.3

## 0.2.7

### Patch Changes

- Updated dependencies [94cfbb0]
  - @strimz/sdk@0.10.0

## 0.2.6

### Patch Changes

- Updated dependencies [2744d9f]
  - @strimz/shared-config@0.6.0
  - @strimz/sdk@0.9.6
  - @strimz/shared-types@0.12.2

## 0.2.5

### Patch Changes

- Updated dependencies [9696813]
  - @strimz/shared-config@0.5.0
  - @strimz/sdk@0.9.5
  - @strimz/shared-types@0.12.1

## 0.2.4

### Patch Changes

- Updated dependencies [518b06c]
- Updated dependencies [518b06c]
  - @strimz/shared-config@0.4.0
  - @strimz/shared-types@0.12.0
  - @strimz/sdk@0.9.4

## 0.2.3

### Patch Changes

- Updated dependencies [6ea1791]
  - @strimz/shared-config@0.3.0
  - @strimz/sdk@0.9.3
  - @strimz/shared-types@0.11.2

## 0.2.2

### Patch Changes

- Updated dependencies [0efff34]
  - @strimz/shared-config@0.2.0
  - @strimz/sdk@0.9.2
  - @strimz/shared-types@0.11.1

## 0.2.1

### Patch Changes

- Updated dependencies [0453728]
  - @strimz/shared-types@0.11.0
  - @strimz/sdk@0.9.1

## 0.2.0

### Minor Changes

- 101ab34: `StrimzCheckoutEmbed` accepts an optional `theme` prop (`'light'` or `'dark'`) that pins the embedded checkout's colour scheme. Without it the embedded checkout now follows the payer's system light or dark preference instead of always rendering light; pass `theme="light"` to keep the previous look.

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
