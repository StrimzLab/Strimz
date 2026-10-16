---
date: 2026-10-03
feature: Dashboard lists load past 100 rows, money totals stay per currency, Withdraw MAX leaves gas, destructive actions ask first
scope: fix
scenario-impact: needs_automation
---

# Dashboard: list paging, per-currency totals, Withdraw MAX, confirmations

Web only. No API, schema, job payload, webhook payload or published package change.

Refs #150. The KPI part is not finished: see "Not fixed here".

## What was wrong

- Payment sessions, subscriptions, invoices, customers, refunds and API keys showed the
  first 100 rows the API returned and nothing more.
- Money totals on the home page, invoices, payment sessions and refunds added EURC
  amounts to USDC amounts and labelled the result USDC. The home volume chart did the
  same.
- Withdraw MAX filled in the whole balance. On Arc the network fee is paid in USDC, so a
  USDC withdrawal of the whole balance could not pay its own fee, and an EURC withdrawal
  failed with no explanation when the wallet held too little USDC.
- Revoking an API key, voiding an invoice, cancelling a subscription or payment session,
  suspending a merchant or admin, removing an admin and approving an agent job ran on
  the first click.

## What shipped

- Those six lists load 100 rows at a time and show a "Load more" button while the API
  reports more rows. Cancelling a session and revoking a key still update the loaded
  rows straight away.
- Totals are summed per currency in base units and shown side by side, for example
  `12.5 USDC · 3 EURC`. The home volume chart draws one line per currency.
- The home "Active subscribers" card reads the server count from `/v1/stats/mrr`
  instead of counting the first 100 active subscriptions.
- Withdraw estimates the transfer's gas through the dashboard wallet once a destination
  is entered, adds 20% to the gas limit and doubles the max fee per gas, and sends the
  transaction with those limits. The worst-case fee, converted from 18-decimal native
  USDC to 6-decimal USDC and rounded up, is shown and held back:
  - USDC: MAX is the balance minus that fee, and any amount that leaves less than the
    fee is refused with a message.
  - EURC: MAX is the whole EURC balance; the withdrawal is refused, with the USDC
    needed and held shown, when USDC cannot cover the fee.
  - The estimate is taken again just before signing and the amount checked again.
- Each destructive action opens a confirmation that says what will happen, including
  the amount and vendor where money is involved.
- The subscription action now reads "Cancel subscription". The API cancels at once; it
  never cancelled at period end, which is what the menu said.
- Admin "Remove" is confirmed as what the API does: it suspends the admin.

## Not fixed here

- KPI cards are still computed in the browser from loaded rows. When more rows exist on
  the server, the cards say so ("Loaded invoices only", "in the latest 100 sessions",
  "Sessions loaded", `N+`) instead of presenting a partial number as a total. Correct
  totals need server-side aggregates per currency (counts and sums by status and time
  window for invoices, sessions, subscriptions, refunds, customers). That is an API
  change and is left for a follow-up.
- `/v1/stats/mrr`, `/v1/stats/ltv`, `/v1/stats/forecast` and the admin volume figures sum
  EURC and USDC on the server. The home MRR card still shows that number labelled USDC.
  Fixing it changes the API response shape.
- The storefront plan picker reads the first 100 active plans, and the agents page reads
  the first 50 jobs and activity rows.

## Check after deploy

On Arc testnet, with the dashboard wallet as payout address: press MAX on USDC, confirm
the held-back fee is shown, withdraw, and check the transaction succeeds. Try EURC with a
near-empty USDC balance and check the message.
