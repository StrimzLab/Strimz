---
date: 2026-09-29
feature: Clear every ESLint warning and enforce --max-warnings 0
scope: chore
scenario-impact: none
---

# Zero-warning lint

Nothing user-facing changed. The lint gate now fails on any warning, in every workspace.

ADR: [ADR-2026-09-29-ai-governance](../adr/ADR-2026-09-29-ai-governance.md), decision 10.
Plan: [2026-09-29-lint-zero-warnings-plan](../plans/2026-09-29-lint-zero-warnings-plan.md).
Closes #106.

## What shipped

- ESLint reports 0 warnings, down from about 600. No rule was disabled or downgraded,
  and no `eslint-disable` comment was added. Eleven stale ones were removed.
- Every workspace `lint` script runs `eslint . --max-warnings 0`.
- The NestJS preset declares `emitDecoratorMetadata` and `experimentalDecorators`. Before
  this, `consistent-type-imports` asked for injected classes to become `import type`,
  which would have broken dependency injection at runtime if anyone had applied the fix.
- `apps/web` and `apps/demo-merchant` lint with the ESLint CLI. `next lint` is removed in
  Next.js 16.
- The scheduler validates outbox entity references with a zod schema instead of `any`.
- `StrimzSubscriptions` stores `merchantId` through `SafeCast.toUint96`.
- The governance ADRs are marked Accepted, and `AGENTS.md` documents worktree removal.

## Contract change

`createSubscription` and `permitAndCreateSubscription` behave as before. The existing
`Subscriptions__InvalidMerchantId` guard rejects an oversized id first, so the SafeCast
revert cannot be reached. Runtime size grows from 16,619 to 16,720 bytes. Storage layout,
events, and function signatures are unchanged. The fix reaches a network only when the
contract is redeployed.

## Known gaps

- `forge lint` still reports 8 `block-timestamp` warnings (5 in `src`, 3 in tests). A
  subscription contract has to compare against `block.timestamp`, so these cannot be
  fixed in code. They need a maintainer decision on excluding that lint in `foundry.toml`.
- The end-to-end suites are not run in CI and have failures that already exist on `main`:
  8 in api, 5 in scheduler, 1 in agent. Their setup also lacks several required
  environment variables. This change leaves those results exactly as they were.
