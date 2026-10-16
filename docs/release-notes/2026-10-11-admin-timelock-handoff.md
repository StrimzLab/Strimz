---
date: 2026-10-11
feature: Admin powers on the contracts are split between a timelock, a Safe and two narrow service keys, and a tested handoff script takes every role away from the deployer
scope: fix
scenario-impact: needs_automation
---

# Contract admin split and timelock handoff

The deploy scripts gave the deployer every role on all seven contracts, and nothing moved
them. `ADMIN_ROLE` covered both the emergency stop and repointing Payments and
Subscriptions at a different Registry, fee collector or token whitelist, so one stolen key
could pause, repoint and unpause in a single block. Nothing stopped the API relayer and
the scheduler from sharing a key.

Fixes #129. ADR:
[ADR-2026-10-10-admin-timelock-handoff](../adr/ADR-2026-10-10-admin-timelock-handoff.md)
([plain-English version](../adr/ADR-2026-10-10-admin-timelock-handoff-for-dummies.md)),
H1 to H7 as recommended.

## What shipped

- **Contracts.**
  - New `PAUSER_ROLE`: `pause()` requires it, `unpause()` keeps `ADMIN_ROLE`. Every
    constructor and `initialize` that granted `ADMIN_ROLE` on a pausable contract also
    grants `PAUSER_ROLE`.
  - `setRegistry`, `setFeeCollector` and `setTokenWhitelist` on Payments and
    Subscriptions, and `setTokenWhitelist` on the escrow, require `DEFAULT_ADMIN_ROLE`.
  - `ADMIN_ROLE` is the role admin of `CHARGER_ROLE` (Subscriptions constructor) and of
    `MERCHANT_REGISTRAR_ROLE` (new `StrimzRegistry.initializeRoleAdmins()`,
    `reinitializer(2)`, `DEFAULT_ADMIN_ROLE` only). `DeployCore` calls it.
- **Handoff.** `script/utils/AdminHandoff.sol` and `script/HandoffAdmin.s.sol`:
  - They deploy an OpenZeppelin `TimelockController`. The Safe is the only proposer and
    canceller, anyone can execute, and there is no admin.
  - They grant the role table in `packages/contracts/README.md` (Admin roles), renounce
    every deployer role and check the result.
  - The script refuses a Safe without code or with a threshold below 2, repeated or zero
    addresses, a zero delay, a deployer that is not admin everywhere, and a Registry
    without its role admins.
  - `script/grant-operator-roles.sh` is deleted; the handoff makes both of its grants.
- **Scheduler.** `validateEnv` refuses a `SCHEDULER_PRIVATE_KEY` whose address equals
  `RELAYER_ADDRESS`, in any letter case.
- **Docs and copy.**
  - The admin merchant Tier box says the Safe sends `setFeeBps`.
  - `on-chain-architecture.mdx` gains "Who controls the contracts".
  - The contracts README gains the role table, the handoff step and the Safe and
    timelock runbooks.
  - The Lightsail README says the scheduler needs its own key.

## Deploy

1. **Contracts.** Payments and Subscriptions are immutable, so the new code reaches
   testnet only through the #142 redeploy. That redeploy then runs `HandoffAdmin.s.sol`,
   following H6:
   - keep the Registry, TokenWhitelist and FeeCollector proxies;
   - upgrade the Registry with `initializeRoleAdmins()`, and upgrade the escrow;
   - deploy new Payments and Subscriptions and move `FEE_ACCRUER_ROLE` to them.

   Testnet subscriptions on the old Subscriptions contract stop renewing. Mainnet is a
   fresh deploy followed by the handoff, before any merchant registers.

2. **Scheduler key.** Before the next Lightsail redeploy, check that
   `SCHEDULER_PRIVATE_KEY` is not the relayer's key: `infra/lightsail/README.md` used to
   suggest sharing one. If they match, the scheduler does not start. Generate a new key,
   fund it with testnet USDC and grant it `CHARGER_ROLE` on the live Subscriptions. Until
   the handoff runs, the deployer can grant it with
   `cast send $STRIMZ_SUBSCRIPTIONS_ADDRESS "grantRole(bytes32,address)" $(cast keccak STRIMZ_CHARGER_ROLE) <new-address>`,
   then revoke it from the relayer address with `revokeRole` and the same arguments.
3. **Safe.** Create a 2-of-3 Safe on Arc (H3) and, optionally, an offline guardian key
   (H4) before the handoff.
4. The web copy goes live on merge (Vercel). No migration, no changeset.

## Scenario impact

`needs_automation`. Covered by Foundry:

- `AdminRoles.t.sol`: the role split, the role admins, and the Registry upgrade through
  the OpenZeppelin validator.
- `AdminHandoff.t.sol`: the handoff end to end, including timelock delay enforcement
  and every refusal.

Covered by the scheduler unit test `signer-separation.test.ts`. The handoff is not
exercised on Arc testnet until #142.
