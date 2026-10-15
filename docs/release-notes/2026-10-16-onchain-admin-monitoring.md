---
date: 2026-10-16
feature: The indexer records role changes, upgrades, timelock operations and agent-registry events, and the scheduler emails operators about every on-chain admin event
scope: feat
scenario-impact: none
---

# On-chain admin monitoring

Resolves #211. ADR: [ADR-2026-10-16-onchain-admin-monitoring](../adr/ADR-2026-10-16-onchain-admin-monitoring.md)
([plain-English version](../adr/ADR-2026-10-16-onchain-admin-monitoring-for-dummies.md)),
D1 to D6 accepted. Supersedes D11 of ADR-2026-10-04-indexer-per-network. The admin console
page is #260.

## What shipped

- **Indexer.**
  - **New required settings:** `AGENT_REGISTRY_ADDRESS` and `TIMELOCK_ADDRESS`. Both
    addresses join the core stream.
  - **New events:** `RoleGranted`, `RoleRevoked`, `RoleAdminChanged`, `Upgraded`, the
    timelock's `CallScheduled`, `CallExecuted`, `Cancelled` and `MinDelayChange`, and the
    five `StrimzAgentRegistry` events.
  - **Audit rows:** each event writes one idempotent `AuditLog` row. It carries the
    contract name and, for roles, a role name from a table checked against the Solidity
    constants (hashes stay as hashes when unknown).
  - **Alerts:** role changes, upgrades, timelock operations and pauses also write a pending
    `ContractAlert` row in the same savepoint. A replay writes neither row twice.
    Agent-registry events are recorded only.
- **Database:** the `ContractAlert` table (migration).
- **Scheduler:**
  - **Job:** `contract-alerts` runs every minute (`CONTRACT_ALERT_CRON`). It sends one
    email to `STRIMZ_ADMIN_ALERT_EMAIL` listing every pending alert for its network, capped
    at 200.
  - **Content:** each entry shows the contract and event, the role and accounts (the
    relayer and the scheduler are labelled), and an Arcscan link.
  - **Stamping:** alerts are stamped only after the send. A failed send leaves them
    pending.
- **Docs:**
  - the indexer README event tables, the self-hosting indexer and scheduler pages, the
    env examples and the redeploy runbook list the new settings;
  - the docs index support callout no longer promises a `#strimz-dev` channel or 24-hour
    replies on every plan.

## Operator steps

- **At the redeploy (#142):** set `AGENT_REGISTRY_ADDRESS` and `TIMELOCK_ADDRESS` for the
  indexer (runbook section 8). The indexer does not start without them.
- **Expect one email after the indexer starts.** It lists the deploy's role grants, the
  handoff's grants and renounces, and the escrow pause, with Arcscan links. Check it
  against the runbook.
- **Check `STRIMZ_ADMIN_ALERT_EMAIL`:** it goes to an inbox someone reads.

## Verification

- **Red, then green:**
  - `admin_events_test.go`: did not compile on `c3a0d9d` (`RoleName` and the two ABIs
    missing).
  - Config tests: did not compile (no new fields).
  - Four processor e2e tests: did not compile.
  - `contract-alerts.e2e.test.ts`: the service did not exist.
- **The role-name test reads the 11 role constants from `StrimzAccessControl.sol` and
  `StrimzAgentEscrow.sol`** and checks each name; the timelock's three roles and
  `DEFAULT_ADMIN_ROLE` are checked directly. The test needs no git submodule.
- **Migration:** applied on Postgres 16 after every earlier migration;
  `prisma migrate diff` against the schema reports no difference.
- **Results:**
  - indexer unit and e2e (store and processor): pass;
  - scheduler unit: 105 of 105;
  - scheduler e2e: 61 of 61;
  - `./scripts/preflight.sh` in full.
