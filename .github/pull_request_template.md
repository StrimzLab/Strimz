## Summary

<!-- What does this PR do? Which product area does it touch (contracts, api, scheduler, agent, indexer, web, sdk)? -->

## Scenario Impact Declaration

- [ ] **scenario-impact**: `updated` | `needs_automation` | `none`
- [ ] Added release note in `docs/release-notes/<date>-<feature>.md` (required for app code changes)
- [ ] Added a changeset (`pnpm changeset`) if a published package changed

## Related

<!-- Closes #123. Link the ADR pair for non-trivial work. -->

## Type of change

- [ ] Feature
- [ ] Bug fix
- [ ] Refactor / chore
- [ ] Docs
- [ ] Contract change (requires redeploy plan in the ADR)
- [ ] Schema change (Prisma migration included)

## Governance & Pre-Review Checklist

- [ ] **Worktree Isolation**: work was done in an isolated branch/worktree.
- [ ] **Human Approval**: ADR pair approved by the maintainer (if non-trivial).
- [ ] **Boundary Validation**: external payloads (HTTP, webhooks, jobs, events, env) validated and mapped to domain types.
- [ ] **Cross-Service Contracts**: ABIs, job payloads, DB columns, and webhook payloads changed on both producer and consumer sides.
- [ ] **Wiring Tests**: tests cover controllers, workers, projections, and UI states, not only helpers.
- [ ] **Test-First Fix**: the bug fix was preceded by a failing regression test.
- [ ] **Precision**: money values use integer base units and carry their currency.
- [ ] **On-Chain Correctness**: projections idempotent on (txHash, logIndex); amounts, token, and merchant verified.
- [ ] **Chain Config**: no hardcoded chain ids or addresses; works for Arc testnet and mainnet.
- [ ] **Security**: auth and scopes enforced; no secrets logged or committed; outbound fetches SSRF-safe.
- [ ] **Loading & Error States**: async actions never freeze the UI.
- [ ] **UI Conventions**: light/dark toggle supported; inputs labelled `(required) *` or `(optional)`.
- [ ] **Layering**: downward imports only; no app imports another app.
- [ ] **Preflight Gate**: `./scripts/preflight.sh` passed with zero errors/warnings.
- [ ] **Preview Verification**: exercised the flow locally or on Arc testnet.

## How this was verified

<!-- What you ran or clicked. For money paths, say which flow you completed and the tx hashes. -->

## Screenshots / notes
