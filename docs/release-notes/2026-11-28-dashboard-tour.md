---
date: 2026-11-28
feature: Dashboard tour covers Test / Live and the key sections
scope: feat
scenario-impact: none
---

# Dashboard tour covers Test / Live and the key sections

The "Take a tour" walkthrough (#579) now runs in first-visit order:

1. **Test and Live:** the switch, then the test banner (in Test only).
2. **Home:** the overview cards, "Get paid" and the volume chart.
3. **Getting paid:** payment links, plans, subscriptions, invoices and the storefront.
4. **After a payment:** transactions, refunds, withdraw and customers.
5. **Building:** AutoPay Agent (when visible), webhooks, API keys (test keys while building, live at launch), settings and documentation.

## How

- Steps whose element isn't on the page are skipped, such as the banner in Live, or the switch on a live-only build.
- On phones the sidebar opens before its links are highlighted.
- Every sidebar link now gets a tour anchor from one rule (`lib/tour-keys.ts`), so new links can join the tour without a hand-kept list.
