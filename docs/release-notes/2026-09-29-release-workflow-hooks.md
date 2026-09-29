---
date: 2026-09-29
feature: Release workflow no longer blocked by the pre-push hook
scope: fix
scenario-impact: none
---

# Release workflow skips git hooks

Nothing user-facing changed. Package releases work again.

Closes #160.

## What happened

The pre-push hook added in #105 runs the fast preflight, which needs Foundry. The
release job installs the hooks through `pnpm install` and has no Foundry, so its push of
the `changeset-release/main` branch was rejected. The first release run after #105 was
the merge of #159, and it failed. Nothing was published.

## What shipped

- The changesets step sets `LEFTHOOK: '0'`, so git hooks do not run on the release
  runner. The commit it pushes holds only version bumps and changelogs, and the pull
  request it opens runs the full CI.
- The workflow accepts `workflow_dispatch`, so a maintainer can start a release by hand.

## Maintainer follow-up after merge

This change touches no release path, so merging it does not start a release. Start one:

```bash
gh workflow run release.yml --ref main
```

It opens the `chore: version packages` pull request from the changeset already on `main`.
