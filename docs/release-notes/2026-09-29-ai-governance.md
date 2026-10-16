---
date: 2026-09-29
feature: AI governance rulebook, preflight gates, release-note gate, and quality check
scope: chore
scenario-impact: none
---

# AI governance and engineering standards

Contributors, human and AI, now work to one rulebook. Nothing user-facing changed.

ADR: [ADR-2026-09-29-ai-governance](../adr/ADR-2026-09-29-ai-governance.md)
([plain-English version](../adr/ADR-2026-09-29-ai-governance-for-dummies.md))

## What shipped

- `AGENTS.md` rulebook and `CLAUDE.md` pointer.
- `.claude/skills/strimz-engineering-standards/SKILL.md` with the architecture and
  craft rules.
- `scripts/preflight.sh`: format (prettier, gofmt), lint (ESLint, go vet), typecheck,
  tests (Vitest, go test, forge test), and build (turbo, forge).
- lefthook pre-push hook running `./scripts/preflight.sh --fast`.
- `scripts/check_release_notes.sh` and a `release notes` CI job.
- `gofmt` step in the CI `go` job; two indexer config files reformatted.
- `quality` CI job aggregating `node`, `go`, `foundry`, and `release notes`.
- Pull request template and `docs/` templates for ADRs, plans, and release notes.
- `.gitignore` entries for `.worktrees/`, root ship scripts, and env files.

## Maintainer follow-up after merge

Require `quality` instead of the three per-stack checks, and enforce the rules for
admins:

```bash
gh api -X PUT repos/StrimzLab/Strimz/branches/main/protection --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["quality"] },
  "enforce_admins": true,
  "required_pull_request_reviews": { "dismiss_stale_reviews": true, "required_approving_review_count": 0 },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

Squash-only merges and branch deletion on merge are already enabled.

Next: `chore/lint-zero-warnings` clears the existing ESLint warnings and turns on
`--max-warnings 0`.
