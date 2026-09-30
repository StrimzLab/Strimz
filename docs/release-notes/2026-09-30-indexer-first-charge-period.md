---
date: 2026-09-30
feature: The first subscription charge records the period it paid for
scope: fix
scenario-impact: none
---

# Subscription charges record the period they paid for

Every successful charge now records the billing period it covers: from the moment the
charge was due to the next charge date. Before, the first charge of a subscription was
recorded with a zero-length period.

Closes #167.

## What was wrong

The indexer used the subscription's current period end as the charge's period start.
On the first charge, which the contract makes due at enrolment, that value is already
one interval ahead, so the charge covered no time at all. Later charges happened to
be right because the two values coincide from then on.

## What shipped

- The charge's period starts at the subscription's `nextChargeAt` before the charge,
  the moment the charge was due, and ends at the next charge date from the event.
- A failed attempt that later succeeds under the same attempt id gets its period
  corrected along with its status.

## Existing rows

First-charge rows written before this change keep their zero-length period. They can be
corrected with one statement, which sets the start one interval before the end:

```sql
UPDATE "SubscriptionCharge" c
   SET "periodStartAt" = s."currentPeriodStartAt"
  FROM "Subscription" s
 WHERE c."subscriptionId" = s.id
   AND c."periodStartAt" = c."periodEndAt"
   AND c."periodEndAt" = s."currentPeriodEndAt";
```

This only repairs first charges whose subscription has not been charged again since.
Rows for subscriptions that moved on need the interval arithmetic and are best left to
a one-off script if the dashboard shows them.
