---
date: 2026-11-23
feature: Safe console in the admin app
scope: feature
scenario-impact: none
---

# Safe console in the admin app

Issue: #557. ADR: ADR-2026-11-23-safe-console.

Super admins can now run admin actions on the Strimz contracts from `/admin/safe`. The Safe web app doesn't support Arc, so before this the only way was the command line.

## How it works

1. **An owner proposes an action from a fixed menu:**
   - pause or unpause Payments or Subscriptions;
   - withdraw fees;
   - grant or revoke a role;
   - add, remove or replace a Safe owner;
   - change the approvals needed;
   - cancel a scheduled change.
2. **Each owner approves with their own wallet** (MetaMask or a hardware wallet, linked through Privy). Approving is a signature and costs nothing. Before offering to sign, the browser decodes the call itself and checks the Safe hash itself.
3. **Once two owners have approved, anyone presses Execute.** The Strimz relayer sends it and pays the network fee. The Safe never refunds gas.

**What waits 48 hours:**

- **No wait:** pausing, unpausing, fee withdrawal, and the relayer and scheduler roles are direct Safe actions. The Safe holds `ADMIN_ROLE` on those contracts.
- **48 hours:** every other role change goes through the Timelock, then needs a second round of approvals to run.

**The guardian panel** lets the guardian pause, or cancel a scheduled change, alone and at once. The contracts only accept those from the guardian's own wallet, which pays a fee well under 0.01 USDC.

## What changed

- **API:**
  - `/v1/admin/safe` endpoints, for `super_admin` only;
  - a `SafeProposal` table (migration `20261123150000_safe_console`);
  - signature checks against the Safe's current owners and nonce;
  - every step goes to the audit log.
- **Signer:**
  - the relayer policy allows `execTransaction` on the Safe with a gas price of 0;
  - a new `pnpm privy:setup safe-rule` step adds it to a relayer that already has rules;
  - `smoke` checks it.
- **Admin app:**
  - the Safe page and its nav item;
  - four write routes through the origin-checked BFF;
  - `viem` is now a declared dependency, and it resolves to the same copy as the shared code.
- **Runbooks:**
  - `docs/runbooks/safe-console.md`, with the command-line fallback;
  - `privy-signers.md`, step 2b.

## Rollout

1. Apply the migration before the API starts.
2. Set `STRIMZ_SAFE_ADDRESS`, `TIMELOCK_ADDRESS`, `STRIMZ_GUARDIAN_ADDRESS`, `STRIMZ_FEE_COLLECTOR_ADDRESS` and `STRIMZ_TOKEN_WHITELIST_ADDRESS` on the API.
3. Run `pnpm privy:setup safe-rule` with the owner key, then `smoke`.

## Verified

- **Hash references:** the Safe transaction hash and the Timelock operation id match references read from the testnet Safe and Timelock themselves.
- **API endpoint tests on Postgres:**
  - super admins only, menu actions only;
  - the hash is cross-checked with the Safe;
  - signatures only from current owners, once each;
  - stale proposals are refused, and removed owners' signatures don't count;
  - the relayer sends sorted signatures with no gas refund;
  - a reverted execute is recorded as failed.
- **Rehearsal on a local fork of Arc mainnet** with the real Safe, Timelock and contracts, using the API's own builder:
  - pause and unpause with two approvals, sent by the relayer;
  - an operational role granted and revoked;
  - a Timelock role grant scheduled and run after 48 hours;
  - the guardian pausing alone and cancelling a scheduled change;
  - a threshold change.
- **Fee withdrawal was not run:** the mainnet FeeCollector holds no fees yet. Only the call path was checked.
- **The command-line fallback:** a `cast wallet sign --data` signature over the runbook's JSON recovers against the Safe's own hash.
- `./scripts/preflight.sh` passed in full.
