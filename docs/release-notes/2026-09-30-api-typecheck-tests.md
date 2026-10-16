---
date: 2026-09-30
feature: API test files are typechecked
scope: chore
scenario-impact: none
---

# API tests are typechecked

Nothing user-facing changed. `pnpm --filter @strimz/api typecheck` now covers the test
files as well as the sources, as the scheduler and agent typechecks already did.

Closes #157.

## What shipped

- `apps/api/tsconfig.test.json` extends the app config and includes `test/`. The
  `typecheck` script uses it. The build config is unchanged, so `nest build` still emits
  `dist/main.js` at the same path.
- The subscription fixture types its `status` and `interval` overrides with the Prisma
  enums instead of hand-written unions. The old union allowed `completed`, which the
  enum does not have.

## Why

A test could reference a field that no longer existed and nothing failed until the test
ran, and CI did not run these tests until #108. One of the stale assertions fixed in #108
would have been a type error here.
