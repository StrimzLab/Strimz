---
'@strimz/shared-types': minor
'@strimz/sdk': minor
---

Request types now describe what the caller sends. Every `XInput` type exported for an `xInputSchema` is now `z.input<typeof xInputSchema>` instead of `z.infer`, so a field the API fills with a default is optional. `strimz.paymentSessions.create({ amount, currency })` now compiles.

Nine types change shape: `CreatePaymentSessionInput` (`expiresInMinutes`), `CreateSubscriptionPlanInput` (`intervalCount`), `CreateSubscriptionInput` (`gracePeriodHours`), `CreateInvoiceInput` (`dueInDays`), `CreateStorefrontInput` (`socialLinks`), `CreateStorefrontProductInput` (`sortOrder`), `UpdateAgentConfigInput` (the fields inside `recovery`, `cashflow` and `commerce`), `CreateBroadcastInput` (`audience`) and `PaginationInput` (`limit`). The other 18 `XInput` types are unchanged.

Each schema also gets an `XParsed` type, `z.output<typeof xInputSchema>`, for the value after `schema.parse` with every default filled in (`CreatePaymentSessionParsed`, `PaginationParsed`, and so on, 27 in total). Code that reads a defaulted field from an `XInput` value, for example on a server that types `schema.parse(req.body)` as `CreatePaymentSessionInput`, no longer compiles: switch it to `CreatePaymentSessionParsed`.
