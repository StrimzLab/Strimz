---
date: 2026-11-23
feature: Mainnet launches without the agent contracts
scope: feature
scenario-impact: updated
---

# Mainnet without the agent contracts

ADR: [ADR-2026-11-23-mainnet-without-agent-escrow](../adr/ADR-2026-11-23-mainnet-without-agent-escrow.md). Runbook: [mainnet-deploy.md](../runbooks/mainnet-deploy.md).

The agent escrow isn't finished (#257), and the audit says it must not reach mainnet until it is (#484). Until now, every mainnet path required its addresses.

## What changed

- **Contracts scripts:**
  - `AdminHandoff`, `HandoffAdmin` and `Verify` accept no agent contracts;
  - they refuse half the pair, with `AdminHandoff__AgentPairIncomplete`;
  - with no agent pair, the role table covers only the five core contracts.
- **Rehearsal:** `rehearse.sh` has `REHEARSE_NETWORK=mainnet`. It forks Arc mainnet, uses mainnet EURC and skips the agent steps. It also uses fresh test accounts, because the well-known Anvil accounts carry EIP-7702 code on Arc mainnet, which turns their signatures into ERC-1271 checks.
- **Indexer:**
  - `AGENT_ESCROW_ADDRESS` and `AGENT_REGISTRY_ADDRESS` are optional, both or neither;
  - the watched-contract lists come from `WatchedContracts` and `LegacyCursorContracts`.
- **Scheduler:**
  - `AGENT_ESCROW_ADDRESS` is optional;
  - the agent-action worker still runs, since it also cancels subscriptions, but `job.*` actions fail with `agent_escrow_not_deployed`, which is never retried.
- **API:** unchanged. It already refuses agent jobs with `403 capability_unavailable`.

## Verified

- **Forge:** the handoff with and without the agent contracts, and the half-pair refusal (31 tests).
- **Indexer:** unit tests, and the e2e tests against Postgres.
- **Scheduler:** 176 unit tests and 120 e2e tests.
- **Rehearsal on a fork of Arc mainnet:** passed.
  - the core deployed, with no agent contracts;
  - the five on-chain flows passed: direct payment, relayed payment, subscription create, charge and cancel;
  - the 2-of-3 Safe was created and admin handed off;
  - `Verify` passed in both phases.
- **Rehearsal on testnet**, with the agent contracts: passed, and the escrow is paused.
