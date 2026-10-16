# Plan: zero-warning lint (2026-09-29)

ADR: docs/adr/ADR-2026-09-29-ai-governance.md (decision 10). Issue: #106.

## Boundaries

- Changes: `packages/eslint-config`, every workspace `lint` script, the files ESLint
  flagged, `StrimzSubscriptions.sol` and four Foundry test files, governance docs.
- Untouched: Prisma schema and migrations, BullMQ job payloads, webhook payloads,
  public API shapes, published package types, contract storage layout and events.

## Interfaces

- `AttestationResult` (agent, internal) becomes a discriminated union so a `complete`
  result always carries `messageHex` and `attestationHex`.
- New `outboxRefSchema` (scheduler, internal) validates the entity references the Go
  indexer and the crons write into `WebhookEvent.payload`. It accepts exactly the nine
  kinds the dispatcher already handled.
- `StrimzSubscriptions` ABI gains the `SafeCastOverflowedUintDowncast` error entry. It
  is unreachable because `Subscriptions__InvalidMerchantId` guards the same bound first.
  The indexer copies events only and the API relay copies two functions only, so neither
  ABI copy changes.

## State changes

None. No migration, no storage layout change. The contract bytecode changes, so the
fix goes live with the next redeploy.

## Test strategy

- New unit tests: `outbox-ref.test.ts` (scheduler), `escape-html.test.ts` (agent).
- Existing suites must stay green: Vitest unit suites, 126 Foundry tests.
- End-to-end suites are compared against an untouched `origin/main` worktree, because
  CI does not run them.

## Steps

1. Teach the NestJS ESLint preset about decorator metadata, so
   `consistent-type-imports` stops flagging injected classes.
2. Move `apps/web` and `apps/demo-merchant` from the deprecated `next lint` to the
   ESLint CLI.
3. Apply safe auto-fixes, then fix the rest by hand. No rule is disabled or downgraded.
4. Add `--max-warnings 0` to every `lint` script.
5. Replace the two unchecked `uint96` casts with `SafeCast.toUint96`; fix the test lints.
6. Flip the governance ADRs to Accepted and document worktree removal.
