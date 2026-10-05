---
'@strimz/sdk': minor
'@strimz/shared-types': minor
---

Breaking: remove the SDK methods the API cannot serve. No deprecation window: none of them succeeds against the current API.

- `@strimz/sdk`: `strimz.subscriptions.create()` is removed. It sent `POST /v1/subscriptions`, which the API has never had, so every call returned 404. A subscription is created by the payer, who signs on the plan's hosted-checkout link (`/sub/<planId>`). Create the plan with `strimz.subscriptionPlans.create()`, send payers to its link, and read the result from the `subscription.created` webhook or `strimz.subscriptions.list()` / `retrieve()`.
- `@strimz/sdk`: `strimz.merchants.update()` and `strimz.merchants.changeTier()` are removed, as announced in 0.6.0. Their routes accept only a dashboard session and returned 403 `permission_denied` to every API key. Change the merchant profile, payout address and tier in the dashboard. `strimz.merchants.me()` is unchanged.
- `@strimz/sdk`: the `CreateSubscriptionInput` type export is removed.
- `@strimz/shared-types`: `createSubscriptionInputSchema`, `CreateSubscriptionInput` and `CreateSubscriptionParsed` are removed. No API route accepted them, and the `gracePeriodHours` they carried was never applied: every subscription gets 48 hours. `updateMerchantInputSchema` and `changeTierInputSchema` and their types stay; the dashboard API uses them.
