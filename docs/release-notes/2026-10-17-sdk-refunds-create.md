---
date: 2026-10-17
feature: strimz.refunds.create returns the refund and its signing instructions
scope: fix
scenario-impact: none
---

# SDK refunds.create

Fixes #294. ADR: `docs/adr/ADR-2026-10-17-sdk-refunds-create.md` (and the for-dummies companion).

## What shipped

- **`@strimz/sdk` (minor):** `refunds.create` parses the API's `{ refund, signingInstructions }` with `refundCreateOutputSchema` and returns `RefundCreateOutput`. It threw on every call before, after the refund row was created.
- `RefundCreateOutput` and `RefundSigningInstructions` are exported from `@strimz/sdk`.
- `refunds.submitSignature` sends only `{ refundTxHash }`; `id` stays in the path.
- **API:** `RefundsService.create` returns the shared `RefundCreateOutput`. Its local copy of the interface is gone. The HTTP response is unchanged.
- **Contract test:** `apps/api/test/e2e/sdk-refunds.e2e.test.ts` drives a real `StrimzClient` against the test app through `test/helpers/inject-fetch.ts`, covering create, submitSignature and retrieve.
- **Docs:** the "Not yet … #294" notes are gone from the refunds guide, resources, SDKs and cancellation pages and the SDK README. The refunds guide shows the SDK call.

## Upgrading

Code typed against the old return type changes from `const refund = await strimz.refunds.create(...)` to `const { refund, signingInstructions } = await strimz.refunds.create(...)`. The old call never succeeded at runtime.

## Operator steps

Publish the `@strimz/sdk` changeset.
