---
date: 2026-10-17
feature: An API cancel also cancels the subscription on chain
scope: fix
scenario-impact: none
---

# On-chain cancel from the API

Fixes #293. ADR: `docs/adr/ADR-2026-10-17-subscription-cancel-onchain.md` (and the for-dummies companion).

## What shipped

- **Contract:** `StrimzSubscriptions.cancel` also accepts a `CHARGER_ROLE` holder, so the scheduler can cancel for the merchant. Payer and merchant-owner cancels, the unknown-id and `AlreadyCancelled` reverts, and the `SubscriptionCancelled` event are unchanged. No ABI signature change.
- **Scheduler:** the `subscription.cancel-onchain` job reads `getSubscription(id).cancelled` first and sends nothing if the payer or merchant already cancelled on chain.
- **API:** the `SubscriptionsService.cancel` comment no longer describes a rollback that doesn't exist.
- **Docs:** the #293 notes are gone from the cancellation, API reference, API subscriptions, subscriptions guide, dashboard subscriptions, self-serve cancel recipe and self-hosting scheduler pages. They say the cancel works from the #142 redeploy and still reverts on the current deployment.

## Operator steps

- Subscriptions is immutable. The fix is live only after the testnet redeploy in #142, and it belongs in the #147 re-review.
- The redeployed Subscriptions must grant `CHARGER_ROLE` to the scheduler, which `AdminHandoff` already does.
- Until then, API cancels on the current deployment still revert on chain; charging stops either way.
