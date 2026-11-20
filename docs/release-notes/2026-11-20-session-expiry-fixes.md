---
date: 2026-11-20
feature: Overdue invoices stay payable, and a late storefront sale takes its stock back
scope: fix
scenario-impact: none
---

# Session expiry fixes

- **Overdue invoices can be paid (#501).**
  - An invoice's checkout session used to expire on its due date. After that, the client got "this checkout session is no longer open", and the merchant got a `payment.failed` for an invoice nobody had tried to pay. The docs promised the opposite.
  - The session now stays open for a year after the due date. Voiding the invoice still closes it at once.
  - Red test: `invoices.e2e.test.ts` binds a payer two days after the due date.
- **A late storefront sale takes its unit back (#502).**
  - A storefront Buy reserves one unit, and the expiry cron returns it after 30 minutes. A payment sent just before expiry could confirm after it, and the sale was recorded without taking the unit back, so the last unit could sell twice.
  - The indexer now takes the unit again when it confirms an `expired` or `cancelled` storefront session. Stock can go to −1, which shows the merchant they oversold by one.
  - Red test: `storefront_stock_e2e_test.go`.
- **Comment fixed.** `storefronts.service.ts` said concurrent buys of the last unit "land at -1". The conditional update stops that, so the comment now says so.
