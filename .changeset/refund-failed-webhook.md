---
'@strimz/shared-types': minor
'@strimz/shared-config': minor
---

Add the `refund.failed` webhook event: `refundFailedEventSchema` and `RefundFailedEvent` in shared-types, and `WEBHOOK_EVENTS.refund.failed` in shared-config. The payload is the refund, with `failureReason`.
