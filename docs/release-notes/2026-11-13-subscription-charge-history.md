---
date: 2026-11-13
feature: Subscription page lists every charge attempt with a plain result
scope: feature
scenario-impact: none
---

# Subscription charge history (#400)

Merchants only saw the charges that worked. A charge that failed, or was skipped because the subscriber's token was delisted, left no trace in the dashboard. See `docs/adr/ADR-2026-11-13-subscription-charge-history.md`.

- **New route** `GET /v1/subscriptions/:id/charges` (`subscriptions_read`, API keys and dashboard sessions). It returns the subscription's `SubscriptionCharge` rows, newest first, with cursor pagination, limited to the merchant and mode.
- **New "Charge attempts" card** on each subscription page. Every attempt shows its period, attempt number, time and a plain result:
  - "Charged" and the failure reasons, such as "Failed: not enough balance", are colour-coded;
  - "Skipped: token not accepted" shows in neutral grey, since the payer did nothing wrong and the subscription stays active;
  - a link opens the transaction on the explorer when there is one.
- The existing transaction list on the same page is now titled "Payments received".

There is no SDK method for the new route yet; adding one changes a published package (#446).
