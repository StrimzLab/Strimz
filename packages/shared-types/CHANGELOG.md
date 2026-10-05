# @strimz/shared-types

## 0.9.0

### Minor Changes

- 5713650: Breaking: remove the SDK methods the API cannot serve. No deprecation window: none of them succeeds against the current API.
  - `@strimz/sdk`: `strimz.subscriptions.create()` is removed. It sent `POST /v1/subscriptions`, which the API has never had, so every call returned 404. A subscription is created by the payer, who signs on the plan's hosted-checkout link (`/sub/<planId>`). Create the plan with `strimz.subscriptionPlans.create()`, send payers to its link, and read the result from the `subscription.created` webhook or `strimz.subscriptions.list()` / `retrieve()`.
  - `@strimz/sdk`: `strimz.merchants.update()` and `strimz.merchants.changeTier()` are removed, as announced in 0.6.0. Their routes accept only a dashboard session and returned 403 `permission_denied` to every API key. Change the merchant profile, payout address and tier in the dashboard. `strimz.merchants.me()` is unchanged.
  - `@strimz/sdk`: the `CreateSubscriptionInput` type export is removed.
  - `@strimz/shared-types`: `createSubscriptionInputSchema`, `CreateSubscriptionInput` and `CreateSubscriptionParsed` are removed. No API route accepted them, and the `gracePeriodHours` they carried was never applied: every subscription gets 48 hours. `updateMerchantInputSchema` and `changeTierInputSchema` and their types stay; the dashboard API uses them.

## 0.8.0

### Minor Changes

- b161025: Add `analytics` schemas and types (also at `@strimz/shared-types/analytics`) for the `/v1/stats/*` responses. Money is now a `CurrencyAmounts` object, `{ USDC, EURC }` in base units, with every currency always present: USDC and EURC are never added together.
  - New: `currencyAmountsSchema`, `paymentCurrencies`, `statsSummarySchema` (`GET /v1/stats/summary`), `statsVolumeSchema` and `statsVolumeQuerySchema` (`GET /v1/stats/volume`), `resolveStatsVolumeRange`, and the admin response schemas.
  - Breaking response changes described by these types: `GET /v1/stats/mrr` returns `mrr` as `CurrencyAmounts` instead of a string; `GET /v1/stats/ltv` requires `?currency=USDC|EURC` (`statsLtvQuerySchema`) and returns `currency`, a real `nextCursor` and `hasMore`; `GET /v1/stats/forecast` returns `{ byCurrency: { USDC, EURC } }`, each with `confidence`, `last90DayRevenue`, `next30`, `next60`, `next90`.

## 0.7.0

### Minor Changes

- 9d91ad2: Request types now describe what the caller sends. Every `XInput` type exported for an `xInputSchema` is now `z.input<typeof xInputSchema>` instead of `z.infer`, so a field the API fills with a default is optional. `strimz.paymentSessions.create({ amount, currency })` now compiles.

  Nine types change shape: `CreatePaymentSessionInput` (`expiresInMinutes`), `CreateSubscriptionPlanInput` (`intervalCount`), `CreateSubscriptionInput` (`gracePeriodHours`), `CreateInvoiceInput` (`dueInDays`), `CreateStorefrontInput` (`socialLinks`), `CreateStorefrontProductInput` (`sortOrder`), `UpdateAgentConfigInput` (the fields inside `recovery`, `cashflow` and `commerce`), `CreateBroadcastInput` (`audience`) and `PaginationInput` (`limit`). The other 18 `XInput` types are unchanged.

  Each schema also gets an `XParsed` type, `z.output<typeof xInputSchema>`, for the value after `schema.parse` with every default filled in (`CreatePaymentSessionParsed`, `PaginationParsed`, and so on, 27 in total). Code that reads a defaulted field from an `XInput` value, for example on a server that types `schema.parse(req.body)` as `CreatePaymentSessionInput`, no longer compiles: switch it to `CreatePaymentSessionParsed`.

## 0.6.0

### Minor Changes

- f2d773f: Add the API key scopes `merchants_read`, `customers_read`, `customers_write` and `analytics_read` to `apiKeyScopeSchema`. The API now rejects an API key on any route that does not name a scope it holds, so `strimz.merchants.me()` needs `merchants_read`, the customers routes need `customers_read` or `customers_write`, `/v1/stats/*` needs `analytics_read`, and the storefront routes need `storefronts_read` or `storefronts_write`.

  Deprecated: `strimz.merchants.update()` and `strimz.merchants.changeTier()`. `PATCH /v1/merchants/me` and `POST /v1/merchants/me/tier` now accept only a dashboard session and return 403 `permission_denied` to every API key. Both methods will be removed in the next minor release.

## 0.5.0

### Minor Changes

- ebc873b: Add `subscriptionEnrolmentTermsSchema` and `StrimzBrowserClient.checkout.planTerms(planId, payer)`. The terms carry the `startAt` a payer must sign for a plan: the end of the plan's trial for a payer who has not subscribed to it before, otherwise `0`. `POST /v1/relay/subscriptions` with a `subscriptionInternalId` now rejects terms that differ from the plan with `enrolment_terms_mismatch`.

## 0.4.0

### Minor Changes

- 3a4c07e: `createStorefrontProductInputSchema` accepts an optional `planId`. Subscription products must carry one and one-time products must not; the API rejects a plan that does not belong to the merchant, is archived, or differs from the product in price, currency or interval. The storefront checkout now returns error code `sold_out` instead of `invalid_request` when a product has no stock left.

## 0.3.2

### Patch Changes

- bd6fc8d: Document enum values that first shipped in 0.3.1 without a changelog entry.

  `subscriptionChargeOutcomeSchema` accepts six more outcomes: `not_due`, `ended`, `duplicate`, `unknown`, `merchant_inactive` and `transfer_failed`. `agentJobStatusSchema` accepts three more statuses: `funded`, `resolved` and `reclaimed`.

  Code that switches over `SubscriptionChargeOutcome` or `AgentJobStatus` needs a branch for the new values. No code changes in this release.

## 0.3.1

### Patch Changes

- 6fed14f: Internal lint cleanup. `hashApiKey` and the notification schema behave exactly as before; no public types changed.

## 0.3.0

### Minor Changes

- 52c8b7b: Add a subscription-status check to the hosted checkout so a wallet can't enrol into the same plan twice. Adds `checkout.subscriptionStatus(planId, payer)` on the browser client and the `SubscriptionStatusResult` type, both backed by the public `GET /v1/checkout/plans/:id/subscription` endpoint.

## 0.2.0

### Minor Changes

- 832c104: Add EIP-712 typed-data intent builders (pay + subscription) to the SDK, with the supporting Zod schemas and inferred types.

## 0.1.1

### Patch Changes

- b1fbded: Standardise README layout and badges. Drop monorepo-internal references and external SDK comparisons from public-facing prose and source comments. No API or behaviour changes.
- Updated dependencies [b1fbded]
  - @strimz/shared-config@0.1.1
