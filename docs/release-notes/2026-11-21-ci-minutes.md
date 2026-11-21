---
date: 2026-11-21
feature: CI uses about a quarter of the GitHub Actions minutes
scope: chore
scenario-impact: none
---

# CI fits the free Actions minutes

The StrimzLab account used all 2,000 free minutes for November. A typical change cost about 35–40 minutes on its PR, and the same again when it merged to main.

## What changed

- **Pushes to main** run only `build`, which refreshes the turbo and Next.js caches every PR starts from. The PR already passed every gate.
- **Docs-only PRs** (only `docs/` or top-level `*.md`) skip `build`, `checks` and `e2e`. `quality` still reports, so branch protection is unchanged. Changes under `apps/docs/content` still count as code, because the docs site build checks the MDX.
- **Fewer small jobs:**
  - the release-notes gate is now a step in `changes`;
  - the Go format, vet, build and unit tests are now a step in `e2e`.
  - Each removed job had cost at least one rounded-up minute.
- **The full-stack e2e** moved to `.github/workflows/full-stack.yml`. It runs on a PR labelled `full-stack`, every Monday at 06:00 UTC on main, or by hand. It was never part of `quality`.
- **Dependabot:** one grouped PR per ecosystem. npm is weekly; Go and GitHub Actions are monthly.

## Expected use

About 20 minutes per PR, and about 4 per merge to main. The full-stack run adds about 6 when it's asked for.
