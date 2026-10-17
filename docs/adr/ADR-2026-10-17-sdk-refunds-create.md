# ADR: `refunds.create` returns `{ refund, signingInstructions }`

- **Status:** Accepted (approved by the maintainer, 2026-10-17)
- **Date:** 2026-10-17
- **Issue:** #294
- **Scope:**
  - `@strimz/sdk` (published, minor bump): the return type of `refunds.create` changes.
  - `apps/api`: the refunds service uses the shared response type, plus a new e2e contract test.
  - Refund docs and the SDK README.
  - No database, contract, queue or webhook change. The HTTP response does not change.

## Context

Checked against `main` at `71fa746`.

1. **The API returns an envelope.** `POST /v1/refunds` returns `{ refund, signingInstructions }`
   (`refunds.service.ts:124-132`). The dashboard needs `signingInstructions` to sign the transfer.
2. **The SDK parses a bare refund.** `RefundsResource.create` validates the response with
   `refundSchema` (`packages/sdk/src/resources/refunds.ts:13-15`). The envelope has no `id`,
   `status` and so on, so the parse fails and `strimz.refunds.create()` throws after the refund row
   was created.
3. **A schema for the envelope already exists.** `refundCreateOutputSchema` and `RefundCreateOutput`
   are in `packages/shared-types/src/refunds.ts:77-89`, and the web dashboard's client already uses
   the type. The API declares its own copy of the interface instead (`refunds.service.ts:20-30`).
4. **No test runs the SDK against the real API response.** `sdk-route-parity.e2e.test.ts` checks
   method and path only: every call is captured with a `418`, so response parsing is never tested.
5. `submitSignature` sends the whole input, `id` included, as the body. The API takes `id` from the
   path and Zod drops the extra key, so it works. The docs already show `{ id, refundTxHash }`
   (fixed in #154).
6. The SDK is `0.10.3`. Changing a public method's return type breaks typed callers, so under 0.x
   it is a minor bump. No caller can rely on today's type, because the call always throws.

## Decision

1. **SDK:** `refunds.create` parses with `refundCreateOutputSchema` and returns
   `Promise<RefundCreateOutput>`. The SDK index exports `RefundCreateOutput` and
   `RefundSigningInstructions`.
2. **SDK:** `submitSignature` sends `{ refundTxHash }` only, matching the API's body DTO and the
   dashboard client. The method's input type stays the same.
3. **API:** `RefundsService.create` returns the shared `RefundCreateOutput`, and the local interface
   is deleted, so the API and the SDK share one definition of the envelope.
4. **Contract test:** a new `apps/api/test/e2e/sdk-refunds.e2e.test.ts` runs a real `StrimzClient`
   against the test app, with a `fetch` that forwards to `app.inject`. It calls `refunds.create`,
   `refunds.submitSignature` and `refunds.retrieve` on a seeded confirmed transaction, so the
   SDK's response schemas are checked against what the API actually sends.
5. **Docs:** the four "Not yet … #294" notes go (`guides/refunds.mdx`, `concepts/resources.mdx`,
   `sdks.mdx`, `subscriptions/cancellation.mdx`) and the README's Refunds bullet. The refunds guide
   shows the SDK call next to the curl.

```
strimz.refunds.create(input)
  └─ POST /v1/refunds ─► RefundsService.create ─► { refund, signingInstructions }   (RefundCreateOutput)
  └─ parse refundCreateOutputSchema ─► caller signs signingInstructions in their wallet
strimz.refunds.submitSignature({ id, refundTxHash })
  └─ POST /v1/refunds/:id/signature  body { refundTxHash } ─► Refund (submitted)
```

## Trade-offs

- **Envelope rather than a flat refund with extra fields.** Keeping the API's shape means no API
  change, the dashboard keeps working, and the docs already describe it. The SDK just catches up.
- **Minor, not patch.** The type change can break a typed build even though the old call never
  worked at runtime. A minor bump is the honest signal under 0.x.
- **Contract test only for refunds.** The same approach could cover every resource. That is
  bigger than this bug, so the helper is written to be reused, but only refunds use it here.

## Tests (red first)

1. `apps/api/test/e2e/sdk-refunds.e2e.test.ts`: `refunds.create` returns `refund.status`
   `awaiting_signature` and `signingInstructions.to` equal to the payer. It throws on `main`. Then
   `submitSignature` returns `submitted` and `retrieve` returns the same refund.
2. `packages/sdk/tests`: `refunds.create` resolves the envelope from a stubbed response, and
   `submitSignature` sends a body without `id`. Both fail on `main`.
