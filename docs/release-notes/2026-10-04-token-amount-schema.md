---
date: 2026-10-04
feature: A malformed token amount is answered with a 400 validation error instead of a 500
scope: fix
scenario-impact: updated
---

# Token amounts: malformed input is a validation error

An API request with a malformed amount, such as `"1.5"`, `"1e6"` or `"abc"`, now gets
`400 invalid_request` naming the `amount` field. It used to get a `500`.

Closes #209.

## What was wrong

`tokenAmountSchema` in `@strimz/shared-types` checked the value against `^[0-9]+$` and
then ran `BigInt(v) >= 0n`. Zod runs a refine even after an earlier check on the same
string fails, so `BigInt("1.5")` threw `SyntaxError` out of `safeParse`. Every request
body that carries a token amount (payment sessions, plans, invoice line items,
storefront prices, refunds and others) turned a malformed amount into an unhandled
error and a `500`.

## What shipped

- The refine is removed. The regex already accepts only non-negative base-10 integers,
  so valid amounts are unchanged and the inferred type is still `string`.
- `@strimz/shared-types` patch release.
- Tests: `safeParse` returns `success: false` for `"1.5"`, `"-1"`, `"1e6"`, `""`, `" 1"`
  and `"abc"` and accepts `"0"` and a 78-digit amount; `POST /v1/payment-sessions` with
  `amount: "1.5"` returns `400 invalid_request` with `param: "amount"` and creates no
  session.

## Other schemas checked

No other zod refine, superRefine or transform in `packages/shared-types/src` or
`apps/api/src` calls `BigInt`, `Number`, `new Date` or `JSON.parse` in a way that can
throw after an earlier check fails. The relay's decimal-string schema converts with
`.transform(BigInt)`, which zod skips once the regex has failed.
