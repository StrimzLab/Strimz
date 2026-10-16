# Plan: restore e2e suites and run them in CI (2026-09-30)

Issue: #108. No ADR: tests and CI only, no runtime behaviour changes.

## Boundaries

- Changes: test files, test helpers and test setup in `apps/api`, `apps/scheduler` and
  `apps/agent`; `apps/api/vitest.e2e.config.ts`; `.github/workflows/ci.yml`.
- Untouched: everything under `src/`, the Prisma schema, contracts, published packages.
- The indexer store suite is repaired in the pull request for #113, because its one
  real failure is that bug.

## Interfaces

None changed. The scheduler chain stub now declares that it implements the public
methods of `ChainService`.

## State changes

None.

## Test strategy

- Measure each suite on untouched `origin/main` first, then after each change.
- For every failing test, decide from the source whether the product or the test is
  wrong. Fix the test only when the product behaviour is intentional. Report anything
  that is a product bug instead of adjusting the assertion.
- Replace assertions that can no longer hold with assertions on the current behaviour,
  and add the cases the old tests did not cover.

## Steps

1. Add the missing environment variables to the api and scheduler global setup.
2. Scheduler: type the chain stub against the service, add `isChargeDue`, update the
   subscription worker and webhook delivery tests, add the outbox dispatcher suite.
3. Agent: drive the bridge worker tests through `pollCount`.
4. Api: enable the commerce capability in the agent job tests, seed registered
   merchants for invoices, rewrite the webhook tests for the outbox, include the smoke
   test.
5. Add the `e2e` CI job and make `quality` depend on it.
