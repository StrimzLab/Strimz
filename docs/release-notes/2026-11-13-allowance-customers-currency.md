---
date: 2026-11-13
feature: Capped subscription approvals with renewal, transactions linked to customers, and a working default currency
scope: feature
scenario-impact: needs_automation
---

# Capped approvals, customer transactions, default currency

## Subscribers approve 12 charges, not unlimited

See `docs/adr/ADR-2026-11-13-capped-subscription-allowance.md`, including its #384 amendment.

- **Checkout** asks for the payer's current allowance to the Subscriptions contract plus 12 charges, or the charges until the plan's end date. It used to ask for `UINT256_MAX`.
  - The approval is additive because a permit replaces the allowance, and all of a payer's subscriptions share it.
  - An existing unlimited approval stays unlimited.
  - The page says what's approved next to the sign button.
- **Reminder:** before each charge, the scheduler reads the allowance. If it covers fewer than two more charges for all of the payer's live subscriptions in that token, it:
  - emails the payer once per period, with a link to `/sub/renew/:subscriptionId`;
  - shows the merchant an `allowance_low` notification in the tray.

  A failed read or email never blocks the charge.

- **Renewal page** `/sub/renew/:subscriptionId`. The payer connects the wallet that subscribed and signs a permit for their current allowance plus 12 charges. Strimz relays it and pays the gas.
  - New public routes:
    - `GET /v1/checkout/subscriptions/:id/renewal`;
    - `POST /v1/checkout/subscriptions/:id/allowance`, payer and status checked;
    - `GET /v1/checkout/subscriptions/:id/submissions/:key`.
  - New relay reason `permitAllowance`, which calls the token's `permit` (bytes overload).
- Existing subscriptions keep their approvals.

## Customer pages show every transaction

See `docs/adr/ADR-2026-11-13-transaction-customer-link.md`.

- The indexer copies the customer onto new transactions: from the payment session for one-off payments, and from the subscription for charges. It reads the session again after confirming it, in case checkout attached the customer meanwhile.
- Migration `20261113130000_backfill_transaction_customer` links the transactions already recorded.
- A customer's Transactions and Refunds sections now fill in.

## Default currency (#452)

Settings → Payout's "Settlement currency" saved a value nothing used, and its name implied payments were converted.

- It's now **Default currency**, with an honest description.
- It's pre-selected in new payment links, plans, invoices and storefront products.
- Payments still settle in the token the customer pays with.

The renewal relay needs a real wallet signature on testnet, so it's marked `needs_automation`.
