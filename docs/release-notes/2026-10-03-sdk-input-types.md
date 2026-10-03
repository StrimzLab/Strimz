---
date: 2026-10-03
feature: SDK request types accept bodies without the fields the API defaults
scope: fix
scenario-impact: none
---

# SDK input types: send what the API needs, not what it fills in

`strimz.paymentSessions.create({ amount, currency })` now compiles. Before this change
the SDK typed every request body as the shape the API ends up with after it applies its
defaults, so a merchant had to pass `expiresInMinutes`, `intervalCount`, `dueInDays` and
similar fields even though the API fills them in. Nothing changes at runtime: the SDK
sends the same body, and the API applies the same defaults.

Closes #156. ADR: [ADR-2026-10-03-sdk-input-types](../adr/ADR-2026-10-03-sdk-input-types.md)
([plain-English version](../adr/ADR-2026-10-03-sdk-input-types-for-dummies.md)).

## What was wrong

- Every `XInput` type in `@strimz/shared-types` was `z.infer<typeof xInputSchema>`,
  which is the schema's output: each field with a `.default()` was required.
- The SDK resource methods take those types, so a caller had to restate the defaults.
  `agents.updateConfig` was the worst case: changing one cashflow flag meant restating
  every other cashflow field.

## What shipped

- `@strimz/shared-types`: all 27 `XInput` types are now `z.input<typeof xInputSchema>`.
  9 of them change shape; the other 18 have no defaults today and stay the same.
- `@strimz/shared-types`: a new `XParsed` type next to each `XInput`,
  `z.output<typeof xInputSchema>`, for the value after `xInputSchema.parse`.
- `@strimz/sdk`: method parameters keep their names (`CreatePaymentSessionInput` and so
  on) and now accept bodies without the defaulted fields. A type-level test in
  `packages/sdk/tests/input-types.test-d.ts` runs with `pnpm test` and guards every
  `XInput`, every `XParsed` and the first parameter of every SDK method that takes a
  body.
- API: services and controllers that hold a parsed body are typed with `XParsed`. The
  hand-written fallbacks that repeated a schema default (`?? 30` for
  `expiresInMinutes`, `?? 1` for `intervalCount`, `?? 7` for `dueInDays`, `?? []` for
  `socialLinks`, `?? 0` for `sortOrder`) are removed; the schema is the only place each
  default lives.
- Web: the admin client's broadcast method takes `CreateBroadcastInput` from
  `@strimz/shared-types` instead of a local copy that required `audience`.

| Type                           | Field that became optional                                                                                                                                                                                                                               | API default                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `CreatePaymentSessionInput`    | `expiresInMinutes`                                                                                                                                                                                                                                       | 30                              |
| `CreateSubscriptionPlanInput`  | `intervalCount`                                                                                                                                                                                                                                          | 1                               |
| `CreateSubscriptionInput`      | `gracePeriodHours`                                                                                                                                                                                                                                       | 48                              |
| `CreateInvoiceInput`           | `dueInDays`                                                                                                                                                                                                                                              | 7                               |
| `CreateStorefrontInput`        | `socialLinks`                                                                                                                                                                                                                                            | `[]`                            |
| `CreateStorefrontProductInput` | `sortOrder`                                                                                                                                                                                                                                              | 0                               |
| `UpdateAgentConfigInput`       | `recovery.gracePeriodHours`, `recovery.strategy`, `cashflow.digestEnabled`, `cashflow.anomalySensitivity`, `cashflow.autoConvertToYield`, `cashflow.minimumLiquidReserveCents`, `commerce.requireHumanApprovalAboveUsdCents`, `commerce.approvedVendors` | see `agentMerchantConfigSchema` |
| `CreateBroadcastInput`         | `audience`                                                                                                                                                                                                                                               | `'all'`                         |
| `PaginationInput`              | `limit`                                                                                                                                                                                                                                                  | 25                              |

## Migrating

Both packages move to the next minor version. Under a caret range on a 0.x version
(`^0.6.0`), a new minor is not picked up automatically; update the range to take it.

- **SDK callers.** No change needed. Code that passes the defaulted fields keeps
  compiling; you can now leave them out.
- **Code that reads a defaulted field from an `XInput` value.** It no longer compiles,
  because the field is now optional. This happens on a server that parses a request
  with the schema and annotates the result as `XInput`:

  Change

  ```ts
  const body: CreatePaymentSessionInput = createPaymentSessionInputSchema.parse(req.body)
  ```

  to

  ```ts
  const body: CreatePaymentSessionParsed = createPaymentSessionInputSchema.parse(req.body)
  ```

  Use `XParsed` wherever you hold the result of `xInputSchema.parse`, and `XInput`
  wherever you build a body to send.

## Not changed here

- `agents.updateConfig` still resets the sibling fields of a section you send to their
  defaults on the server, because the schema's `.partial()` is shallow. The type now
  matches what the API accepts; the data bug is tracked in #197.
- `strimz.subscriptions.create` posts to a route the API does not have. Tracked in #198.
- `CreatePaymentSessionInput.supportedSourceChains` is accepted and still not read by
  the API. Its future waits on the launch scope decision in #145.

## Deploy

No migration, no configuration and no ordering requirement. The API change is type
annotations and the removal of fallbacks the schema already guarantees.
