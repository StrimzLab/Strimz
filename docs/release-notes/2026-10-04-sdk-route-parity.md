---
date: 2026-10-04
feature: The SDK no longer ships methods the API cannot serve, and a test keeps every SDK method matched to an API route
scope: fix
scenario-impact: none
---

# SDK route parity

`@strimz/sdk` 0.8.0 removes three methods that failed on every call:
`subscriptions.create`, `merchants.update` and `merchants.changeTier`.
`@strimz/shared-types` 0.9.0 removes `createSubscriptionInputSchema` and its two types. A
new API e2e test drives every method of both SDK clients and fails when one has no
matching API route, or lands on a route its key cannot call.

Closes #198. ADR: [ADR-2026-10-04-sdk-route-parity](../adr/ADR-2026-10-04-sdk-route-parity.md)
([plain-English version](../adr/ADR-2026-10-04-sdk-route-parity-for-dummies.md)).

## What was wrong

- `subscriptions.create` sent `POST /v1/subscriptions`. The API has never had that
  route, so every call returned 404. A subscription needs the payer's permit and intent
  signatures, which a merchant's server does not hold.
- `merchants.update` (`PATCH /v1/merchants/me`) and `merchants.changeTier`
  (`POST /v1/merchants/me/tier`) hit dashboard-only routes, which return 403
  `permission_denied` to every API key. 0.6.0 deprecated both and promised removal in
  the next minor; 0.7.0 and 0.7.1 kept them.
- Nothing compared the SDK with the API, so the mismatch was never caught.

## What shipped

- `@strimz/sdk` 0.8.0: `SubscriptionsResource` keeps `retrieve`, `list` and `cancel`.
  `MerchantsResource` keeps `me`. The `CreateSubscriptionInput` type export is gone.
- `@strimz/shared-types` 0.9.0: `createSubscriptionInputSchema`,
  `CreateSubscriptionInput` and `CreateSubscriptionParsed` are gone.
  `updateMerchantInputSchema` and `changeTierInputSchema` stay, because the API uses them.
- `apps/api/test/e2e/sdk-route-parity.e2e.test.ts`: reads every registered controller
  route, calls every `StrimzClient` and `StrimzBrowserClient` method through a recording
  `fetch`, and checks that each sends one request to a registered route its key may
  call. The call table is typed from the client classes, so adding or removing an SDK
  method fails `tsc` until the table matches.
- Docs: `subscriptions/recovery.mdx` no longer shows `subscriptions.create` or a
  `gracePeriodHours` of 168 (the schema allowed 24, 48 or 72, and the indexer writes 48
  on every subscription). `subscriptions/plans.mdx`, `authentication.mdx` and the SDK
  README no longer list the removed methods.

No API route, contract, migration, queue payload or webhook payload changed.

## Migration for integrators

TypeScript code that references a removed method or type stops compiling on upgrade to
0.8.0. None of these calls succeeds against the current API, so no working behaviour is lost.

| Removed                                                                                | Use instead                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `strimz.subscriptions.create(...)`                                                     | Create the plan with `strimz.subscriptionPlans.create(...)` and send the payer to its hosted page, `/sub/<planId>`. The payer signs there. Listen for the `subscription.created` webhook, or read with `strimz.subscriptions.list({ planId })`. |
| `CreateSubscriptionInput`, `createSubscriptionInputSchema`, `CreateSubscriptionParsed` | Nothing. No route accepts this body.                                                                                                                                                                                                            |
| `strimz.merchants.update(...)`                                                         | Change the business profile and payout address in the dashboard settings.                                                                                                                                                                       |
| `strimz.merchants.changeTier(...)`                                                     | Change the tier in the dashboard.                                                                                                                                                                                                               |

`strimz.merchants.me()` and every other method are unchanged.

## Not in this change

The subscription docs also describe `subscriptions.pause`, `subscriptions.resume`,
`subscriptions.chargeNow`, `subscriptions.cancel({ immediate })` and
`subscriptions.listAll`, which exist in neither the SDK nor the API. That is tracked in
#210.
