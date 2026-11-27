---
date: 2026-11-27
feature: Testnet contracts redeployed, run by one key
scope: ops
scenario-impact: none
---

# Testnet contracts redeployed, run by one key

Part of step 2 of [ADR-2026-11-26-test-mode](../adr/ADR-2026-11-26-test-mode.md) (#565).

## What changed

- **New testnet contracts**, deployed 2026-11-27 from block `74376690`. They're listed in `README.md` and `packages/contracts/README.md`, and logged in `packages/contracts/deployments/5042002.json`.
  - Verify (`deployed`) passed.
  - The agent escrow is paused (tx `0xb653b66ffaf799044c4bf754d41408688098acadd36ef55b66da5032a7084f5f`).
  - Source was submitted to the testnet explorer.
- **No Safe or timelock on testnet** (founder, 2026-11-27). The testnet deployer key keeps the admin roles, because testnet holds no real money. The ADR's deployment table records this as an amendment.
- **The indexer needs `TIMELOCK_ADDRESS` on mainnet only.** On testnet it can be left empty, and then the indexer doesn't watch a timelock. A malformed value is still refused.
- **`docs/runbooks/testnet-deployment.md`** now says to deploy, verify, pause the escrow with the deployer key and publish the source, with no handoff.
- **Testnet addresses and start block** updated in `infra/lightsail/env.example` and `apps/indexer/.env.example`.
- **Self-hosting docs:** the indexer page says `TIMELOCK_ADDRESS` is for mainnet.

## Earlier attempt, kept in the log

An earlier deploy the same day was handed to the 2-of-2 testnet Safe. Its entries (core, agent, handoff) stay in `deployments/5042002.json` as a record, but nothing uses them.

## Not changed

- Mainnet. Its contracts, Safe, timelock and the indexer's mainnet rules are as before.
