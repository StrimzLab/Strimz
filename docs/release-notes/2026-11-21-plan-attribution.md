---
date: 2026-11-21
feature: Subscriptions land on the plan the subscriber chose, even when two plans share a price
scope: fix
scenario-impact: none
---

# Subscriptions land on the right plan

Fixes #497. ADR: [ADR-2026-11-20-subscription-plan-attribution](../adr/ADR-2026-11-20-subscription-plan-attribution.md).

When a merchant had two active plans with the same price and interval, the indexer filed a new subscriber under whichever plan Postgres returned first. The wrong plan then followed the subscription everywhere: webhooks, dashboard counts, the "already subscribed" check and the relay's double-signup guard.

## What changed

- **New table, `SubscriptionEnrolment`** (migration `20261121090000_add_subscription_enrolment`):
  - it maps a signed intent nonce to the merchant, plan and payer;
  - the relay writes it after the nonce check passes and before the transaction is queued;
  - a retry is a no-op.
- **The indexer resolves the plan** from the nonce on `SubscriptionCreated`, in this order:
  1. The recorded plan, if it belongs to the event's merchant and has the event's terms.
  2. Otherwise, the only active plan with the same terms.
  3. Otherwise, the oldest such plan. The subscription's `metadata.planMatch` is `"ambiguous"`. This only happens for a signup made outside Strimz checkout.
  4. Otherwise, a new plan, as before.
- **The full-stack renewal test** is back to 2 USDC, the same price as the checkout suite's plan. The #498 workaround is gone.

## Tests

- The Go store e2e tests were red first: the recorded plan was ignored, and the ambiguous pick was arbitrary and unflagged. They also cover:
  - a record whose terms differ;
  - a record for another merchant;
  - a single match.
- A stream wiring test fails without the projector passing the nonce.
- A relay unit test checks the record is written once, before the job is queued, and not written when the nonce is wrong.

## Rollout

Apply the migration before the API starts writing to the table. It's additive.
