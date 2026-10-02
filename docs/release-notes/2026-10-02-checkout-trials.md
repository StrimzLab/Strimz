---
date: 2026-10-02
feature: Plan free trials are honoured, and enrolments are checked against the plan
scope: fix
scenario-impact: needs_automation
---

# Free trials start free

A customer who subscribes to a plan with a free trial is no longer charged at sign-up.
The first charge happens when the trial ends. Each customer gets the trial once per plan.
Every enrolment from the hosted page is now checked against the merchant's plan before
Strimz sends it to the chain.

Closes #115. ADR: [ADR-2026-10-02-checkout-trials](../adr/ADR-2026-10-02-checkout-trials.md)
([plain-English version](../adr/ADR-2026-10-02-checkout-trials-for-dummies.md)).

## What was wrong

- The subscribe page signed `startAt = 0`, so every enrolment was charged at once.
  `trialPeriodDays` was read nowhere.
- `POST /v1/relay/subscriptions` did not compare the signed terms with the plan.
- The indexer wrote every subscription as `active` and never set `trialEndsAt`.
- The scheduler's due sweep skipped `trialing` subscriptions.

## What shipped

- `GET /v1/checkout/plans/:id/terms?payer=0x…` returns the `startAt` to sign: the end of
  the trial for a payer who has never subscribed to the plan, otherwise `0`. The browser
  SDK exposes it as `checkout.planTerms(planId, payer)`.
- The hosted subscribe page shows the trial and first charge date, and fetches fresh
  terms right before the payer signs.
- With a `subscriptionInternalId`, the relay now rejects an enrolment whose plan,
  merchant, token, amount, interval, end or start differs from the plan, with 400
  `enrolment_terms_mismatch`. A trial start may be 15 minutes off. Enrolments without a
  plan id are unchanged.
- The indexer writes a subscription whose first charge is in the future as `trialing`,
  with `trialEndsAt` and a current period from enrolment to the first charge. The first
  successful charge moves it to `active`.
- The scheduler's due sweep includes `trialing`. Due dates still decide when anyone is
  charged.

## Customers charged before this change

Customers who subscribed to a trial plan before this change were charged at enrolment.
Nothing is refunded automatically. To list them per merchant:

```sql
SELECT s.id, s."merchantId", s."payerAddress", p."trialPeriodDays", s."createdAt"
  FROM "Subscription" s
  JOIN "SubscriptionPlan" p ON p.id = s."planId"
 WHERE p."trialPeriodDays" > 0
   AND s."trialEndsAt" IS NULL
 ORDER BY s."merchantId", s."createdAt";
```

## SDK

`@strimz/shared-types` and `@strimz/sdk` gain the terms schema and method (minor).
Merchants calling `POST /v1/relay/subscriptions` with a plan id must now sign terms that
match the plan.
