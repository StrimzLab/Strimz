---
date: 2026-10-16
feature: A Transactions page and detail page in the dashboard, refunds started from a transaction in its own currency, and transaction filters by payment session and subscription
scope: feat
scenario-impact: none
---

# Dashboard, part 1 of 3: transactions and refunds

Part of #149. ADR:
[ADR-2026-10-16-dashboard-plans-sessions-transactions](../adr/ADR-2026-10-16-dashboard-plans-sessions-transactions.md)
([plain-English version](../adr/ADR-2026-10-16-dashboard-plans-sessions-transactions-for-dummies.md)),
D1 to D5 accepted. The customer detail page is #263.

## What shipped

- **API.** `GET /v1/transactions` accepts `sessionId` and `subscriptionId`, validated as
  ids and scoped by merchant and mode like the other filters.
- **SDK (`@strimz/sdk`, minor).** `transactions.list` accepts the same two filters.
- **Transactions page** at `/app/transactions`, in the sidebar under Payments:
  - filters by kind and status;
  - amount and net in each transaction's currency;
  - CSV export;
  - rows open the detail page.
- **Transaction detail page:**
  - amount, Strimz fee, net, payer and payout addresses, and the block;
  - an Arcscan link, and the session, subscription, customer or refund it belongs to;
  - **Refund** on confirmed, non-refund transactions.
- **Refund dialog** (now shared by the Refunds page and the transaction page):
  - it opens pre-filled from a transaction;
  - from the Refunds page, it looks up a pasted transaction ID before you can continue;
  - the amount is labelled and parsed in that transaction's currency, so EURC is no longer
    shown as USDC;
  - `buildRefundInput` checks the amount: above 0, at most 6 decimals, and no more than
    the transaction. The API still enforces the total refunded.
- **Sidebar.** Detail pages highlight their parent entry.
- **Docs.**
  - New `dashboard/transactions` page.
  - `dashboard/refunds` rewritten to match the dialog, the statuses the flow uses, and
    signing by your own wallet.

## Operator steps

None.

## Verification

- **Red, then green:**
  - API `transaction-filters.e2e.test.ts`: 3 of 4 failed. The malformed-id test passed
    on `8facf0a` too, because the strict query schema refused the unknown key; it stays
    as a guard.
  - SDK type test: `transactions.list({ sessionId })` did not type-check.
  - Web `refund-input.test.ts` and `transactions-view.test.ts`: the modules did not
    exist.
  - Web `dashboard-transactions.test.ts`: 4 failed.
- **Results:**
  - web: 385 of 385;
  - API e2e: 346 of 346;
  - `./scripts/preflight.sh` in full.
