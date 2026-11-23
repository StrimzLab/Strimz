---
date: 2026-11-23
feature: Mainnet deploy runbook fixes and private address record
scope: chore
scenario-impact: none
---

# Mainnet deploy runbook fixes

Runbook: [mainnet-deploy.md](../runbooks/mainnet-deploy.md).

The Strimz contracts are deployed on Arc mainnet, admin is handed to the Safe through a 48-hour Timelock, and the source is verified. The addresses and transaction hashes are kept in the private ops manual, not in this public repo.

## What changed

- `packages/contracts/deployments/5042.json` is gitignored, and the runbook no longer names mainnet addresses.
- The runbook warns that forge loads the testnet `packages/contracts/.env` for any unset setting, so every mainnet setting must be exported.
- Source verification uses Sourcify, because the explorer's API blocks scripts. Explorer keys are unset so forge can't fall back to the explorer and print them.

## Verified

- On mainnet: `Verify` passed after the deploy and after the handoff. The deployer holds no role.
- All nine contracts match on Sourcify, for both the runtime and the creation code.
