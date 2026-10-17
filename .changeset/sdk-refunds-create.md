---
'@strimz/sdk': minor
---

`refunds.create` now returns `{ refund, signingInstructions }`, the shape the API sends. It used to throw on every call because it expected a bare refund. `RefundCreateOutput` and `RefundSigningInstructions` are exported. `refunds.submitSignature` sends only `refundTxHash` in the body.
