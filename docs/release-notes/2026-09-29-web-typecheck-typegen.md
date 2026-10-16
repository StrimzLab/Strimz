---
date: 2026-09-29
feature: Web typecheck works on a fresh checkout again
scope: fix
scenario-impact: none
---

# Web typecheck generates its own types

Nothing user-facing changed. The preflight and the pre-push hook pass on a fresh
checkout or a new worktree again.

Closes #163.

## What happened

Image imports in `apps/web` get their types from `next-env.d.ts`, a generated file that
is gitignored. Until #159 the lint step was `next lint`, which wrote that file before
the typecheck ran. #159 moved lint to the ESLint CLI, so nothing wrote the file and
`tsc` failed with twelve `TS2307` errors. CI did not catch it because it builds before
it typechecks.

## What shipped

The `typecheck` script in `apps/web` and `apps/demo-merchant` runs `next typegen` before
`tsc`. The typecheck no longer depends on an earlier lint, build, or dev run.
