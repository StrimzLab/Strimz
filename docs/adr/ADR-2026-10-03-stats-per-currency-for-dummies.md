# ADR for Dummies: Dashboard numbers counted by the server, and dollars kept apart from euros

- **Status:** Accepted 2026-10-03
- **Date:** 2026-10-03

## The Idea

The dashboard's summary cards are added up in the browser from the first 100 records it
has loaded, so a busy merchant sees partial totals. Some analytics figures, such as
monthly recurring revenue, also add euro (EURC) payments to dollar (USDC) payments and
show the result as dollars. We move the counting to the server, which sees every record,
and every money figure is reported separately for USDC and EURC.

## What the Person Sees

1. A merchant with 400 invoices opens the Invoices page. Today "Outstanding" covers only
   the newest 100 and says "Loaded invoices only". After this change it covers all 400
   and the note is gone.
2. The merchant has 30 USDC and 9 EURC of monthly subscriptions. Today the home page shows
   "MRR 39 USDC". After this change it shows "30 USDC · 9 EURC".
3. The home page's 7-day volume includes subscription renewals, not only one-off
   payments, and uses the time the payment landed on the blockchain.
4. The Analytics page's top customers list has a USDC / EURC switch, because customers
   cannot be ranked across two currencies without an exchange rate.
5. A Strimz operator on the admin home sees live volume, fees and MRR per currency, and
   can switch to test mode. Test payments are no longer mixed into live numbers.

## Important Limitation

There is still no single "total revenue" across USDC and EURC. Strimz has no exchange
rate and this change does not add one. Developers who read the analytics endpoints with
an API key must update their code, because the answers change shape.

## What Changes

- One new endpoint gives every dashboard card its exact numbers, and one gives the daily
  volume chart.
- Monthly recurring revenue, the revenue forecast, top customers and all admin volume
  figures are reported per currency.
- Admin figures are for live mode by default, with a switch to test mode.
- Top customers starts working for real payments; today it is empty because payments are
  not linked to customers in the place it looks.
- One database index to keep the new totals fast.
- The shared types package gets a new minor version describing these answers.

## What Does Not Change

- Payments, subscriptions, refunds, invoices, webhooks and the smart contracts.
- The tables on each page, which still load 100 rows at a time.
- Who can see analytics: the same `analytics_read` permission covers the new endpoints.
