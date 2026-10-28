---
date: 2026-10-28
feature: Zero-address checks in Payments, paused-only escrow whitelist change, one-step Registry init
scope: fix
scenario-impact: none
---

# Contracts: small safety clean-ups before the redeploy

Four small findings from the 2026-10-28 audit. None of them changes how a payment, subscription or escrow job works.

Refs #381 (epic #387). ADR: [ADR-2026-10-28-contract-hygiene](../adr/ADR-2026-10-28-contract-hygiene.md).

`StrimzPayments` can't be upgraded, so its changes take effect at the #142 redeploy. The Registry and escrow changes take effect at their next deploy or upgrade, which is the same #142 deploy.

## What shipped

- **Payments setters:** `setRegistry`, `setFeeCollector` and `setTokenWhitelist` revert with `Payments__ZeroAddress()` (`0x17568d6d`) for a zero address. Before, they reverted with `Payments__InvalidAmount()`.
- **Payments constructor:** a zero `admin`, registry, fee collector or token whitelist reverts with `Payments__ZeroAddress()`, the same check `StrimzSubscriptions` already has.
- **Agent escrow:** `setTokenWhitelist` needs the escrow to be paused, like the Payments and Subscriptions setters. Send `pause`, `setTokenWhitelist` and `unpause` as one Safe or timelock batch.
- **Registry:**
  - `initialize` makes `ADMIN_ROLE` the admin of `MERCHANT_REGISTRAR_ROLE`.
  - `initializeRoleAdmins()` (`reinitializer(2)`) is removed, and `DeployCore` no longer calls it.
  - The handoff still refuses a Registry where this isn't set.

## Testnet note

The current testnet Registry (`0x23bb25315107bf7463a84913eccd450a43f71ae3`) is still at initializer version 1, and `ADMIN_ROLE` is not the admin of its registrar role. With `initializeRoleAdmins` gone, upgrading that proxy can't fix this.

#142 deploys a fresh Registry with `DeployCore` and retires the old set, so nothing needs doing. Don't run the admin handoff against the old Registry: it refuses with `AdminHandoff__ServiceRoleAdminNotSet`.

## Ships with #142

Nothing in the apps. The ABIs drop `initializeRoleAdmins` from the Registry. No app or indexer code calls it, and #386 regenerates the ABIs.

## Tests

- **New:** `test/ContractHygiene.t.sol`.
  - On `main`, 7 of its 8 tests fail for the reasons above. The eighth, an escrow change while paused, already worked.
  - All 8 pass with the fix.
- **Removed:** three `AdminRoles` tests that called `initializeRoleAdmins`. They covered calling it once, the role it needed, and calling it through an upgrade. The new test checks that a fresh Registry already has both role admins set.
- **Changed:**
  - `AdminHandoff.t.sol` setup no longer calls `initializeRoleAdmins`.
  - `test_refusesRegistryWithoutRoleAdmins` builds its old Registry from the `StrimzRegistryV1` fixture.
- `./scripts/preflight.sh` passes in full.

## Sizes

| Contract            | Runtime (B) | Margin (B) |
| ------------------- | ----------- | ---------- |
| StrimzPayments      | 12,762      | 11,814     |
| StrimzRegistry      | 13,205      | 11,371     |
| StrimzAgentEscrow   | 16,505      | 8,071      |
| StrimzSubscriptions | 19,567      | 5,009      |
