---
date: 2026-10-16
feature: Merchants create payment links from the dashboard and open each payment session's page, with its payment, Cancel and Refund
scope: feat
scenario-impact: none
---

# Dashboard, part 2 of 3: payment sessions

Part of #149. ADR:
[ADR-2026-10-16-dashboard-plans-sessions-transactions](../adr/ADR-2026-10-16-dashboard-plans-sessions-transactions.md)
([plain-English version](../adr/ADR-2026-10-16-dashboard-plans-sessions-transactions-for-dummies.md)).

## What shipped

- **New session** on the Payment sessions page opens a dialog.
  - **Fields:**
    - amount and currency (required);
    - description, customer email, expiry in minutes, and success and cancel URLs (all
      optional).
  - **Checks:** `buildPaymentSessionInput` applies the 1.00 minimum, at most 6 decimals,
    an expiry of 1 to 1440 minutes, a valid email and http(s)-only URLs.
  - **On success** it shows the checkout link with a copy button and a link to the
    session.
- **Session detail page** at `/app/payment-sessions/<id>`:
  - amount, fee and net, payer wallet and email, expiry, and the payment link;
  - the on-chain transaction with an Arcscan link, and its transactions (through the
    `sessionId` filter from part 1);
  - **Cancel** for open sessions, and **Refund** for a confirmed payment.
- **The session list** links each row to its page, and its empty state no longer says
  sessions can only come from the API.
- **The create toast** shows formatted amounts, not base units.
- **Transaction pages** link to their session.
- **`MINIMUM_PAYMENT_AMOUNT`** in `@strimz/shared-config` (minor) is now the one source of
  the 1.00 minimum. The API's `assertMinimumAmount` uses it.
- **Refactor:** the amount parsing shared by the refund and session dialogs moves to
  `parseTokenAmountInput`.
- **Docs:** `dashboard/payment-sessions` is rewritten to match the page, the dialog and
  the seven real statuses.

## Operator steps

None.

## Verification

- **Red, then green:**
  - `payment-minimum.test.ts` (shared-config) failed;
  - `payment-session-input.test.ts`: the module did not exist;
  - `dashboard-sessions.test.ts`: 5 failed.
- **The refund-input tests** still pass after the parser refactor.
- **Results:**
  - web: 406 of 406;
  - `./scripts/preflight.sh` in full.
