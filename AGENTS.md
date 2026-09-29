# Engineering Standards & AI Governance Rulebook

All AI coding agents (Claude Code, Codex, Antigravity, Qwen Code, and custom LLM dev
harnesses) and all human contributors operating in this repository MUST abide by the
rules, architectural layering, and lifecycle in this document and in
`.claude/skills/strimz-engineering-standards/SKILL.md`.

Strimz moves money. A defect here is a payer charged twice, a merchant paid nothing, or
funds stuck in a contract. The rules below exist because each of those has happened in
review, not in theory.

---

## Core Mandatory AI Governance Directives

### Directive 1: Read-Only Long-Lived Branches & Mandatory Worktree Isolation

Direct commits or pushes to `main` are strictly forbidden for all AI agents. `main` is
the only long-lived branch. Long-running feature branches (for example `chain-agnostic`)
are not long-lived branches: they are cut from `main`, rebased or merged from `main`, and
land through a pull request like any other branch.

All feature development, refactoring, and bug fixing MUST be conducted in isolated Git
worktrees under `.worktrees/`, created off the branch the work is destined for, using
`git worktree add`. AI agents must never assume a local branch is current without
explicitly syncing ground truth.

### Directive 2: Human Approval Gate (Phase 1 DECIDE)

AI agents are strictly prohibited from implementing non-trivial features,
architectural changes, contract changes, schema changes, or framework modifications
without authoring TWO Architectural Decision Records under `docs/adr/`:

1. Technical ADR (`docs/adr/ADR-<YYYY-MM-DD>-<topic>.md`): full technical
   specification covering context, decision, architectural impact, trade-offs, and
   a component or sequence diagram.
2. Simplified Companion ADR (`docs/adr/ADR-<YYYY-MM-DD>-<topic>-for-dummies.md`):
   plain-English context, decision, and impact for non-technical stakeholders.

- An AI agent is strictly forbidden from approving its own ADRs or implementation plan.
- Execution MUST NOT begin until explicit, unambiguous human approval is granted on
  both ADR documents. Silence is not approval. A question about the ADR is not approval.
- Any change to a Solidity contract, a Prisma migration, a BullMQ job payload, a
  webhook payload, or a published package's public API is non-trivial by definition.

### Directive 3: Red-Green Test-First Bug Fixing Protocol

When addressing any bug, regression, or defect, the AI agent MUST follow this order:

1. Red: write a failing unit or integration test that reproduces the defect (Vitest
   for TypeScript, `go test` for the indexer, `forge test` for contracts). Run it and
   confirm it fails for the exact reason identified.
2. Green: implement the minimal production fix. Re-run and confirm clean passage with
   no secondary regressions.

### Directive 4: Prohibition of Error Swallowing & Symptom Masking

AI agents are forbidden from resolving build errors, type errors, or test failures by
masking them:

- Do NOT wrap failing operations in silent `try/catch` blocks or empty catch handlers.
  In Go, do NOT discard errors with `_ =` or log-and-continue where the caller needs
  to know. In Solidity, do NOT add a `try/catch` that hides a revert reason.
- Do NOT bypass type checks with `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error`, or
  loose `any` casts. Do NOT add `eslint-disable`, `//nolint`, or `forge-lint: disable`
  to silence a finding.
- Do NOT return dummy, empty, or fallback objects to hide missing data or broken
  upstreams. Do NOT fall back to a testnet address, a default chain id, or a default
  token when configuration is missing: fail loudly.
- Do NOT comment out, weaken, skip, or delete failing assertions or test cases.
- Do NOT raise a budget, a timeout, a gas limit, or a threshold to make a gate pass.
  Fix the cause.

### Directive 5: Local Preflight Verification Enforcement

Before submitting any Pull Request or marking a task complete, the AI agent MUST run
`./scripts/preflight.sh`. All five gates (format, lint, typecheck, tests, production
build) across the TypeScript workspaces, the Go indexer, and the Foundry contracts
must complete with zero warnings and zero errors. A gate that passes only when run
alone does not count; the full run is the verdict.

### Directive 6: Minimal, Human-Written Comments

Comments are kept to a minimum and are written by people.

- Default to no comment. Names, types, and structure carry the meaning.
- A comment is allowed only when it is necessary: it states something a reader cannot
  get from the code, such as why a decision was made, an outside constraint, or a
  hazard that is not visible locally.
- AI-generated comments are not allowed. AI agents MUST NOT write, rewrite, or extend
  a comment in any language in this repository. That covers line and block comments,
  JSDoc, Go doc comments, and Solidity NatSpec.
- When an agent believes a comment is necessary, it names the file, the line, and the
  reason in the pull request description. A human decides and writes the comment.
- When an agent's change makes an existing comment false, the agent removes nothing
  and rewrites nothing on its own judgment: it lists the comment in the pull request
  description so a human corrects it before merge.

---

## Multi-Stage Development Lifecycle (Phases 0-8)

```
[Phase 0: SYNC] --> [Phase 1: DECIDE] --> [Phase 2: PLAN]
                                                |
[Phase 5: BUILD] <-------------- [Phase 3: ISOLATE]
       |
       v
[Phase 6: VERIFY] --> [Phase 7: DOCUMENT] --> [Phase 8: DELIVER]
```

### Phase 0: SYNC

`git fetch origin main`. Never rely on a stale local ref. Other contributors merge to
`main` often; read what changed before planning.

### Phase 1: DECIDE

For non-trivial work, author both ADRs, present them, and pause until the human
approves. Trivial work (a typo, a copy change, a one-line fix with a regression test)
skips this phase; when unsure, it is not trivial.

### Phase 2: PLAN

`docs/plans/<date>-<feature>-plan.md`: component boundaries, interface contracts,
state changes, test strategy, and UI mockups where relevant.

### Phase 3: ISOLATE

```bash
git worktree add .worktrees/<branch-name> -b <branch-name> origin/main
cd .worktrees/<branch-name>
git submodule update --init --recursive   # Foundry deps in packages/contracts/lib
pnpm install --frozen-lockfile
```

After the pull request merges, remove the worktree from the repository root. A worktree
that has initialised submodules cannot be removed without `--force`:

```bash
git worktree remove --force .worktrees/<branch-name>
git worktree prune
```

### Phase 5: BUILD

Test-driven implementation inside the architectural layering rules in SKILL.md.

### Phase 6: VERIFY

`./scripts/preflight.sh`, then exercise the flow by hand against a local stack or the
Arc testnet deployment, including the edge cases the ADR named. For money paths, say
which flow you completed and which transaction hashes prove it.

### Phase 7: DOCUMENT

`docs/release-notes/<date>-<feature>.md` with the required frontmatter and a
`scenario-impact` declaration (`updated | needs_automation | none`). If a published
package (`@strimz/shared-config`, `@strimz/shared-crypto`, `@strimz/shared-types`,
`@strimz/sdk`, `@strimz/sdk-react`) changed, add a changeset with `pnpm changeset`.

### Phase 8: DELIVER

Open the PR against `main` using `.github/pull_request_template.md`. All CI checks
green, including `quality`, before requesting review. AI agents do not commit or push
on a contributor's behalf unless asked; they prepare a gitignored `ship-<topic>.sh` at
the repository root for the human to run (see SKILL.md).

---

## Mandatory Pre-Review Defect Audit Checklist

1. Boundary validation: every external input (HTTP body, query, webhook, BullMQ job
   payload, on-chain event, RPC response, env var) is validated at the edge with zod
   (TypeScript) or explicit decoding (Go) and mapped to a domain type. Raw upstream
   JSON never reaches a service or component.
2. Cross-service contracts change together: a BullMQ job payload, contract ABI, event
   signature, Prisma column, or webhook payload is changed in producer and consumer in
   the same PR, from one shared definition, with a test on each side.
3. Wiring tests over mechanism tests: tests cover the real controllers, workers,
   projections, and route handlers, not only isolated helpers.
4. Test-first fix verification: every bug fix was locked by a failing test first.
5. Money precision: amounts are integer base units (`bigint` in TypeScript,
   `*big.Int` or `numeric` in Go and Postgres, `uint256` in Solidity), carried with
   their currency and token decimals, and converted only at the display edge. USDC
   and EURC are never summed together.
6. On-chain correctness: event projections are idempotent on `(txHash, logIndex)`;
   a payment confirms an off-chain record only after amount, token, and merchant match;
   no state flips before the transaction is confirmed; signer nonces are managed.
7. Chain configuration: chain ids, RPC URLs, token addresses, and contract addresses
   come from `@strimz/shared-config` or validated env, never hardcoded in an app, and
   work for both Arc testnet and Arc mainnet.
8. Security: every route enforces auth and scope; secrets are never logged, returned,
   or committed; outbound requests to user-supplied URLs are SSRF-safe; idempotency
   keys are not guessable.
9. Loading and error states: every async operation shows a loading state and handles
   failure visibly. No frozen UI, no unhandled rejection.
10. UI conventions: every web surface supports the user-visible light/dark toggle;
    every form input is labelled `(required) *` (red asterisk) or `(optional)`.
11. Layering: imports point downward only; apps never import other apps; shared
    packages never import apps.
12. Release hygiene: schema changes ship a Prisma migration (applied migrations are
    never edited); published package changes ship a changeset.
13. Preflight: `./scripts/preflight.sh` passed in full.
14. Comments: every comment in the diff is necessary and was written by a human. No
    comment was written, rewritten, or extended by an AI agent.
