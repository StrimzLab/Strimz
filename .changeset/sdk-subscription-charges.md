---
'@strimz/sdk': minor
---

Add `subscriptions.charges(id, { limit, cursor })`, which lists every charge attempt for a subscription (successful, failed and skipped), and export the `RefundFailedEvent` webhook type.
