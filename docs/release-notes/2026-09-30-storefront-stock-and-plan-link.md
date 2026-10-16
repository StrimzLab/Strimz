---
date: 2026-09-30
feature: Storefront stock is held during checkout and subscription products sell a real plan
scope: fix
scenario-impact: needs_automation
---

# Storefront stock reservation and subscription plan link

A storefront unit is now held while the buyer pays and returned if the checkout is
cancelled or times out. Two buyers can no longer both take the last unit. Subscription
products now link to one of the merchant's plans, so their Buy button works.

Closes #124 (parts 2 and 3; parts 1 and 4 shipped in #180).
ADR: [ADR-2026-09-30-storefront-stock-and-plan-link](../adr/ADR-2026-09-30-storefront-stock-and-plan-link.md)
([plain-English version](../adr/ADR-2026-09-30-storefront-stock-and-plan-link-for-dummies.md)).

## What was wrong

- Checkout read the stock, created the session, then ran an unconditional decrement.
  Two concurrent buyers of the last unit both passed and the row landed at -1. An
  abandoned session never gave its unit back.
- `createStorefrontProductInputSchema` had no `planId`, so every subscription product
  was created without a plan and every checkout of one returned 400.

## What shipped

- Migration `20260930150000_payment_session_storefront_product`: nullable
  `PaymentSession.storefrontProductId` with a foreign key to `StorefrontProduct`
  (`ON DELETE SET NULL`) and an index.
- Checkout reserves the unit with `UPDATE ... SET stock = stock - 1 WHERE stock > 0`
  in the same transaction as the session insert. Zero rows means 409 `sold_out` and no
  session. Unlimited stock (`null`) is untouched.
- The unit is released once, in the same transaction as the status flip: API cancel
  and expire, and the scheduler's session-expiry sweep. Submitted and confirmed sessions
  keep their unit.
- `planId` on the published create-product schema, required for subscription products
  and forbidden for one-time ones. The API rejects a plan that is not the merchant's,
  not active, or differs from the product in price, currency, interval or interval
  count.
- Dashboard: choosing "subscription" shows a required plan picker. Price, currency and
  interval come from the chosen plan and the price field locks.
- Tests: nine API e2e cases in `storefront-checkout.e2e.test.ts`, one scheduler e2e in
  `session-expiry.e2e.test.ts`, four web unit tests for the form payload.

## Deploy

Run `prisma migrate deploy` before starting the new API and scheduler. Subscription
products created before this change have no plan and never worked; archive them and
create new ones with a plan.

## Known limitation

A payment that confirms after its session expired is still confirmed by the indexer,
but the unit was already returned at expiry. Stock then reads one higher than reality.
This matches today's behaviour for late payments and is not fixed here.
