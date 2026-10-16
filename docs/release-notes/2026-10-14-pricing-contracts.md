---
date: 2026-10-14
feature: The registry takes a fee ceiling at registration, merchants can no longer lower it, and a fee-manager role lets the scheduler move merchants between plans
scope: fix
scenario-impact: none
---

# Pricing plans, part 1 of 4: contracts

Part of #250, and resolves the contract side of #146. ADR:
[ADR-2026-10-14-pricing-plans](../adr/ADR-2026-10-14-pricing-plans.md)
([plain-English version](../adr/ADR-2026-10-14-pricing-plans-for-dummies.md)), D1 to D7
accepted (D4 here). This ships with the testnet redeploy (#142). It does not change
deployed contracts.

## What shipped

- **`registerMerchant(owner, payout, feeBps, maxFeeBps, parentMerchantId)`.**
  - The ceiling is set separately, with `feeBps <= maxFeeBps <= MAX_FEE_BPS`.
  - A Free merchant can register at 0 bps with a 50 bps ceiling, so it can later be moved
    to Starter (50 bps) and Growth (40 bps).
- **`setMaxFeeBps` is removed,** with its error `Registry__MaxFeeCanOnlyLower` and its
  event `MerchantMaxFeeBpsLowered`.
  - A merchant's owner wallet can no longer lower its ceiling, which also snapped the fee
    down. That let any merchant cut its fee to 0 for good (#146).
  - No role can charge a merchant more than its registration ceiling.
- **`FEE_MANAGER_ROLE`** may call `setFeeBps` within the ceiling, alongside `ADMIN_ROLE`.
  - Its role admin is `ADMIN_ROLE`, set at initialization, so the Safe can revoke it at
    once.
  - `AdminHandoff` grants it to the scheduler, includes it in the deployer's renounce
    list, and checks its role admin.
  - `Verify` (`handed-off`) and the rehearsal check it.
- **Scripts and docs.** `e2e.sh` registers with the new signature. The contracts README
  role table and the two runbooks list the scheduler's new role.

## Operator steps

None now. At the redeploy the scheduler's KMS address receives `FEE_MANAGER_ROLE` from
`HandoffAdmin`. The API's registration call moves to the new signature in part 2 of
#250.

## Verification

- **`FeeManager.t.sol` (8 tests) and `AdminHandoff.t.sol`'s new
  `test_schedulerManagesFeesAfterHandoff`:** failed to compile on `84b6898`, with no
  `FEE_MANAGER_ROLE` and no five-argument `registerMerchant`. All pass now.
  - The fee manager moves a 0 bps merchant to 50 and then 40 bps, and cannot pass the
    ceiling.
  - A stranger is refused.
  - `setMaxFeeBps` no longer exists.
- **Existing tests:**
  - every call against the current registry passes the fee as its ceiling, keeping its
    meaning;
  - the three `setMaxFeeBps` tests are removed with the function;
  - calls on the V1 upgrade fixture are unchanged.
- **Results:**
  - `arc-forge test --network arc` from clean: 207 of 207;
  - the fork suite: 4 of 4;
  - `./script/rehearse.sh`: passes, with the post-handoff role table including the
    scheduler's `FEE_MANAGER_ROLE`;
  - `./scripts/preflight.sh` in full.
