---
'@strimz/sdk': minor
---

`paymentSessions.list`, `subscriptions.list`, `transactions.list`, `refunds.list` and `invoices.list` take a `customerId` filter. `customers.list({ walletAddress })` now filters on the server.
