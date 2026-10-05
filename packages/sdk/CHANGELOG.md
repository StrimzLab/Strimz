# @strimz/sdk

## 0.8.0

### Minor Changes

- 5713650: Breaking: remove the SDK methods the API cannot serve. No deprecation window: none of them succeeds against the current API.
  - `@strimz/sdk`: `strimz.subscriptions.create()` is removed. It sent `POST /v1/subscriptions`, which the API has never had, so every call returned 404. A subscription is created by the payer, who signs on the plan's hosted-checkout link (`/sub/<planId>`). Create the plan with `strimz.subscriptionPlans.create()`, send payers to its link, and read the result from the `subscription.created` webhook or `strimz.subscriptions.list()` / `retrieve()`.
  - `@strimz/sdk`: `strimz.merchants.update()` and `strimz.merchants.changeTier()` are removed, as announced in 0.6.0. Their routes accept only a dashboard session and returned 403 `permission_denied` to every API key. Change the merchant profile, payout address and tier in the dashboard. `strimz.merchants.me()` is unchanged.
  - `@strimz/sdk`: the `CreateSubscriptionInput` type export is removed.
  - `@strimz/shared-types`: `createSubscriptionInputSchema`, `CreateSubscriptionInput` and `CreateSubscriptionParsed` are removed. No API route accepted them, and the `gracePeriodHours` they carried was never applied: every subscription gets 48 hours. `updateMerchantInputSchema` and `changeTierInputSchema` and their types stay; the dashboard API uses them.

- aa97e01: **Breaking:** `StrimzClient` now refuses to start in a browser runtime. Constructing it with a secret key in a browser page, a web worker, an Electron renderer or React Native throws `StrimzAuthenticationError` with code `secret_key_in_browser` and no `httpStatus`. The message links to https://strimz.finance/docs/checkout/server-sessions and never contains the key. There is no option to turn the check off. Node (including test environments with jsdom or happy-dom), Deno, Bun, Vercel Edge, Cloudflare Workers and unrecognised runtimes are unaffected. Create payment sessions on your server and pass the session id to the browser.
  - New error code: `secret_key_in_browser` is added to `StrimzErrorCode`. An exhaustive `switch` over `StrimzErrorCode` needs a case for it.
  - The `X-Strimz-Sdk-Runtime` header now reports `deno`, `bun`, `workerd` or `electron-renderer` where it used to report `unknown` or `browser`.
  - `StrimzBrowserClient` is unchanged.

### Patch Changes

- Updated dependencies [5713650]
  - @strimz/shared-types@0.9.0

## 0.7.1

### Patch Changes

- Updated dependencies [b161025]
  - @strimz/shared-types@0.8.0

## 0.7.0

### Minor Changes

- 9d91ad2: Request types now describe what the caller sends. Every `XInput` type exported for an `xInputSchema` is now `z.input<typeof xInputSchema>` instead of `z.infer`, so a field the API fills with a default is optional. `strimz.paymentSessions.create({ amount, currency })` now compiles.

  Nine types change shape: `CreatePaymentSessionInput` (`expiresInMinutes`), `CreateSubscriptionPlanInput` (`intervalCount`), `CreateSubscriptionInput` (`gracePeriodHours`), `CreateInvoiceInput` (`dueInDays`), `CreateStorefrontInput` (`socialLinks`), `CreateStorefrontProductInput` (`sortOrder`), `UpdateAgentConfigInput` (the fields inside `recovery`, `cashflow` and `commerce`), `CreateBroadcastInput` (`audience`) and `PaginationInput` (`limit`). The other 18 `XInput` types are unchanged.

  Each schema also gets an `XParsed` type, `z.output<typeof xInputSchema>`, for the value after `schema.parse` with every default filled in (`CreatePaymentSessionParsed`, `PaginationParsed`, and so on, 27 in total). Code that reads a defaulted field from an `XInput` value, for example on a server that types `schema.parse(req.body)` as `CreatePaymentSessionInput`, no longer compiles: switch it to `CreatePaymentSessionParsed`.

### Patch Changes

- Updated dependencies [832149c]
- Updated dependencies [9d91ad2]
  - @strimz/shared-crypto@0.2.0
  - @strimz/shared-types@0.7.0

## 0.6.0

### Minor Changes

- f2d773f: Add the API key scopes `merchants_read`, `customers_read`, `customers_write` and `analytics_read` to `apiKeyScopeSchema`. The API now rejects an API key on any route that does not name a scope it holds, so `strimz.merchants.me()` needs `merchants_read`, the customers routes need `customers_read` or `customers_write`, `/v1/stats/*` needs `analytics_read`, and the storefront routes need `storefronts_read` or `storefronts_write`.

  Deprecated: `strimz.merchants.update()` and `strimz.merchants.changeTier()`. `PATCH /v1/merchants/me` and `POST /v1/merchants/me/tier` now accept only a dashboard session and return 403 `permission_denied` to every API key. Both methods will be removed in the next minor release.

### Patch Changes

- Updated dependencies [f2d773f]
  - @strimz/shared-types@0.6.0

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
