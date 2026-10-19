---
date: 2026-10-19
feature: Customer detail page, customerId list filters and wallet lookup
scope: feat
scenario-impact: needs_automation
---

# A page for each customer

Closes #263.

- **ADR:** `docs/adr/ADR-2026-10-19-customer-detail.md` and its for-dummies companion.

## What shipped

- **`/app/customers/[id]`:**
  - **Header:** the full wallet, the receipt email and the external ref (each with copy), plus first seen and last active.
  - **Sections:** payments, subscriptions, transactions, refunds and invoices, each the newest 25 with its own empty and error states.
  - **Links:** each row opens its own page; a refund opens the payment it refunded.
- **The Customers list:**
  - the name and wallet link to the customer page;
  - the row menu has "View customer".
- **API:** an optional `customerId` filter on `GET /v1/payment-sessions`, `/v1/subscriptions`, `/v1/transactions`, `/v1/refunds` and `/v1/invoices`.
  - Refunds are matched through the payment they refund, and invoices through their payment session.
  - Another merchant's customer gets an empty page; a malformed id gets 400.
- **`GET /v1/customers?walletAddress=`** finds a customer whatever the letter case. The list query is now validated, so an invalid `limit` or wallet gets 400.
- **`@strimz/sdk` (minor):** `customerId` on the five list methods. `customers.list({ walletAddress })` now filters on the server.
- **Migration `20261019120000_customer_filter_indexes`:** adds the `PaymentSession(merchantId, customerId)` and `Refund(transactionId)` indexes. No column changes.
- **Docs:**
  - `dashboard/customers.mdx` now matches the product. Gone are the "Lifetime value" column and the multi-email claims. Receipts go to the stored email, which is the first one a wallet gave.
  - The payment sessions, subscriptions and invoices API pages mention `customerId`.

## Not changed

- How customers and emails are recorded at checkout, and where receipts go.

## Operator steps

- The migration runs on the next API deploy (`migrate deploy` in the entrypoint). It only adds two indexes; both tables are small today.
- Publish `@strimz/sdk` through the usual changesets version PR.
