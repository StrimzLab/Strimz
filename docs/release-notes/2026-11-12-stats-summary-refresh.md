---
date: 2026-11-12
feature: Stat cards stay in step with the tables
scope: fix
scenario-impact: none
---

# Stat cards refresh

After creating a payment link and receiving a payment on it, the Payment links cards showed "Total sessions 1" and "Confirmed 0 USDC" while the table listed 2 sessions, one confirmed.

The cards read the stats summary, which the dashboard kept for 5 minutes and didn't refresh after creating or cancelling a payment link or cancelling a subscription. A payment confirmed on-chain never refreshed it either.

- Creating or cancelling a payment link and cancelling a subscription now refresh the summary, as invoices and refunds already did.
- The summary refreshes every 30 seconds while a page with cards is open, the same pace as notifications, so on-chain payments appear without a reload.
- The longer cache still applies to the analytics charts.

This covers every page whose cards use the summary: Home, Payment links, Subscriptions, Invoices, Refunds and Customers.
