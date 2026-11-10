---
date: 2026-11-10
feature: Scheduler and agent start again after a restart
scope: fix
scenario-impact: none
---

# Scheduler and agent dev restart

`pnpm dev` in `apps/scheduler` and `apps/agent` failed with
`Cannot find module .../dist/main` whenever the app had been built before.

Nest deletes `dist` on start, but TypeScript's incremental cache
(`tsconfig.build.tsbuildinfo`) sits outside `dist`. It said nothing had changed, so
nothing was emitted. Both build configs now set `incremental: false`, the same as
`apps/api`. Production images build once from clean, so they were never affected.

`scripts/preflight.sh` now stops early with the fix when the contract submodules aren't
checked out (a fresh worktree), instead of failing the forge build with hundreds of
missing-import errors.
