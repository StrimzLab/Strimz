---
date: 2026-10-13
feature: Deploy tooling matches the contracts, a full rehearsal runs on an Arc testnet fork, and a runbook covers the testnet redeploy
scope: chore
scenario-impact: none
---

# Testnet redeploy tooling and rehearsal

Part of #142. ADR:
[ADR-2026-10-13-testnet-redeploy](../adr/ADR-2026-10-13-testnet-redeploy.md)
([plain-English version](../adr/ADR-2026-10-13-testnet-redeploy-for-dummies.md)), R1 to
R8 as recommended.

- The redeploy itself runs once every logged issue is resolved; the maintainer runs it
  from the runbook.
- It is a full redeploy; the ADR records that this supersedes #129's H6 for testnet.
- A follow-up records the new addresses (R8).

The testnet contracts in use date from 2026-07-10. None of the contract fixes since are
live: #100 (audit findings), #189, #203, #207 and #129.

## What shipped

- **Deployment log (R1).** `DeploymentLog.append` writes only when a script broadcasts;
  dry runs print the entry. It now records the address that broadcast.
  - Every earlier entry in `deployments/5042002.json` shows `0x1804…1f38`, Foundry's
    default script sender, because the log read `tx.origin` after `vm.stopBroadcast()`.
  - The July contracts' real admin is `0xd9dB…E645`, from their `RoleGranted` events.
- **Verification (R2).** `Verify.s.sol` requires `STRIMZ_VERIFY_PHASE`:
  - `deployed` checks the deployer's admin roles on all seven contracts.
  - `handed-off` checks the timelock's delay, proposer and open execution, and the full
    `AdminHandoff` role table with no role left on the deployer.
  - Both phases check the agent contracts, the escrow's whitelist pointer and the USDC
    and EURC capability flags.
- **End-to-end (R3).** `e2e.sh` and `Digests.s.sol` use the current interfaces:
  - two signatures for `payWithAuthorization`;
  - a nonce and two signatures for `permitAndCreateSubscription`;
  - the nine-field `getMerchant`;
  - intent digests read from the deployed contracts.
  - It runs on `arc-cast` and `arc-forge`.
- **Source verification (R4).** `verify.sh` runs on `arc-forge inspect` and `arc-cast`.
- **Rehearsal (R5).** `script/rehearse.sh` forks Arc testnet with
  `arc-anvil --network arc` (chain id 31337). On the fork it:
  - deploys core and agent, runs `Verify deployed`, and runs the five e2e flows;
  - creates a 2-of-3 Safe through the Safe v1.4.1 factory on Arc testnet;
  - hands off admin with a 5-minute timelock, then runs `Verify handed-off`;
  - checks that the log recorded the real deployer.
- **Runbook (R6, R7).** `docs/runbooks/testnet-redeploy.md` covers:
  - prerequisites, the rehearsal, deploy, verification, e2e, handoff and source
    verification;
  - pausing the old Payments and Subscriptions with `0xd9dB…E645`;
  - the testnet data reset;
  - the env, `START_BLOCK`, Vercel and Lightsail changes.

## Operator steps

None until the redeploy. Then follow `docs/runbooks/testnet-redeploy.md`. The data reset
in its step 7 does the following:

- clears merchants' on-chain registration, so they re-register on first use;
- cancels subscriptions and clears their on-chain ids;
- expires open payment sessions;
- cancels open agent jobs and clears their on-chain ids.

The new Subscriptions and AgentEscrow number from 1 again, and the on-chain id columns
are unique. That is why the old ids are cleared.

## Verification

- **`DeploymentLog.t.sol`:** both tests failed before the change, because a
  non-broadcast run wrote the log. They pass after.
- **The rehearsal's recorded-deployer check:** before the fix it failed with
  `recorded deployer 0x1804…1f38, expected 0xf39F…2266`. It passes after.
- **`main`'s `e2e.sh` on a fresh fork deploy:** it reverts at the first
  `payWithAuthorization` (`execution reverted`, ABI mismatch).
- **`./script/rehearse.sh` on a fork of `rpc.testnet.arc.io`:** passes end to end.
  - Deploy, and `Verify deployed` with every check `[ok]`.
  - The e2e flows: a 1 USDC classic payment and a 1 USDC `payWithAuthorization`, each
    split 980,000 net and 20,000 fee; a permit subscription created and cancelled.
  - Safe `getThreshold() == 2`, the handoff, and `Verify handed-off` with
    "deployer holds no role".
- **Simulated `pause()` on the old contracts:** succeeds from `0xd9dB…E645` and reverts
  from `0x1804…1f38`.
- `./scripts/preflight.sh` in full.
