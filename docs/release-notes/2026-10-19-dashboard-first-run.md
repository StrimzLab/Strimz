---
date: 2026-10-19
feature: No-code first run and plain-language labels in the dashboard
scope: feat
scenario-impact: needs_automation
---

# Getting paid in the dashboard without writing code

Closes #284. Part of #286.

- **ADR:** `docs/adr/ADR-2026-10-19-dashboard-first-run.md` and its for-dummies companion.

## What shipped

- **A "Get paid" card on the home page,** shown until the first confirmed payment.
  - **"No code" tab (first):** create a payment link or plan, share it, then see it land.
  - **"With your developer" tab:** API key, test payment, webhook.
  - Steps tick themselves off.
  - Step 1 opens the new-payment-link dialog through `/app/payment-sessions?new=1`.
- **Renamed labels:** "Sessions" is now "Payment links" (sidebar, page, dialog, toasts) and the "Buyers" group is now "Customers". The URLs are unchanged.
- **Empty states with a next step** on Payment links, Plans, Subscriptions, Invoices, Customers, Transactions and Refunds. `DataTable` takes `emptyAction`.
- **Home cards:**
  - "Monthly recurring revenue" replaces "MRR";
  - plain helper lines;
  - values roll up once on load (still under reduced motion);
  - the 30-day chart has an empty state with "Create a payment link".
- **The dashboard tour** shows Payment links before API keys.

## Scenario impact

`needs_automation`: add an e2e scenario for a signed-in merchant creating a payment link from the home card, paying it in test mode and seeing it on Transactions.

## Operator steps

None. Web only; it deploys with the next Vercel build.
