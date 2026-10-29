---
date: 2026-10-29
feature: Undoable operator cancels and 24-hour fee increases for the scheduler key
scope: fix
scenario-impact: needs_automation
---

# Contracts: limit what a leaked scheduler key can do

The scheduler's key charges subscriptions. It can also cancel them when a merchant asks, and set a merchant's fee when they change plan. If the key leaked, an attacker could have:

- cancelled every subscription, with no way back;
- raised every merchant to the 0.5% cap at once.

Both features stay. After this change, an operator cancel can be undone for 7 days, and a fee increase waits 24 hours, during which the Safe can stop it.

Refs #378 (epic #387). ADR: [ADR-2026-10-29-scheduler-key-limits](../adr/ADR-2026-10-29-scheduler-key-limits.md).

`StrimzSubscriptions` can't be upgraded, and the Registry deploys fresh with #142, so both changes take effect at the #142 redeploy.

## What shipped

### Subscriptions

- **`CANCELLER_ROLE`** (`keccak256("STRIMZ_CANCELLER_ROLE")` = `0x923a66ef…aa40`):
  - `cancel` now needs this role. `CHARGER_ROLE` keeps only `batchCharge`.
  - The constructor grants the role to `admin` and makes `ADMIN_ROLE` its role admin.
- **Operator cancels:** a cancel by `CANCELLER_ROLE` (not the payer or merchant owner) is recorded in `operatorCancelledAt(id)` (`0x6f26d708`). Payer and owner cancels stay final.
- **`reinstate(uint256)`** (`0xb3100f99`):
  - only `ADMIN_ROLE` can call it, and it works while paused;
  - it undoes an operator cancel within `REINSTATE_WINDOW` (7 days);
  - it emits `SubscriptionReinstated(subscriptionId, by)`, topic `0xb4e84d6f…41e9`;
  - it reverts with `Subscriptions__NotReinstatable(id)` or `Subscriptions__ReinstateWindowClosed(id)`.
- **After a reinstate:** the next charge bills one period. The existing period-skip logic means the payer is never billed for the gap.

### Registry

- **`setFeeBps` by `FEE_MANAGER_ROLE`:**
  - A decrease applies at once.
  - An increase is pending for `FEE_INCREASE_DELAY` (24 hours) and emits `MerchantFeeIncreaseScheduled(merchantId, feeBps, effectiveAt)`, topic `0x8cbe23e8…03ba`.
  - An `ADMIN_ROLE` caller still applies any change at once, and clears a pending increase.
- **`commitFeeBps(uint256)`** (`0x06531ebe`): anyone can call it once the increase is due. It emits `MerchantFeeBpsUpdated` and reverts with `Registry__NoPendingFeeChange()` or `Registry__FeeChangeNotDue()`.
- **`cancelFeeIncrease(uint256)`** (`0x5c56cc35`): `ADMIN_ROLE` only. It emits `MerchantFeeIncreaseCancelled(merchantId)`, topic `0xf5f71d06…ecc4`.
- **`pendingFeeOf(uint256)`** (`0x4f09925e`): returns `(feeBps, effectiveAt)`. `getMerchant` is unchanged, so charges use the committed fee until the increase is applied.

### Handoff

- The scheduler also gets `CANCELLER_ROLE`, so the role table grows to 36 grants, or 39 with a guardian.
- `renounceAll` and `verify` cover the new role, and the role-admin check includes it.

### Docs

- The contracts README role table, `docs/runbooks/kms-signers.md` and `docs/runbooks/testnet-redeploy.md` list the new role.

## Ships with #142

- **Scheduler plan-upgrade cron:**
  - For a fee increase (Free to Starter), schedule it with `setFeeBps`, then call `commitFeeBps` on a later tick once `pendingFeeOf` shows it is due.
  - Move `Merchant.tier`, write `merchant.plan_upgraded` and email the merchant only after the fee on chain matches the plan.
  - Decreases are unchanged.
- **Scheduler agent-action cancel:** no change, because the scheduler key holds `CANCELLER_ROLE` after the handoff.
- **Indexer:**
  - `SubscriptionReinstated` moves the subscription back to `active`, with an audit row and an admin alert.
  - `MerchantFeeIncreaseScheduled` and `MerchantFeeIncreaseCancelled` get audit rows and admin alerts.
  - Add `CANCELLER_ROLE` to `internal/abi/roles.go`, so role events name it.
- **API:** fire `subscription.reactivated` to the merchant when a subscription is reinstated.
- **Incident runbook:** for a leaked scheduler key:
  1. Revoke its roles from the Safe.
  2. List the operator cancels since the leak (`SubscriptionCancelled` where `by` is the scheduler).
  3. Reinstate the ones the merchant didn't request, within 7 days.
  4. Cancel any pending fee increases.

## Tests

- **New: `test/SchedulerKeyLimits.t.sol`, 16 tests.**
  - On `main`, the charger cancel and the instant fee increase fail. The two guards (an admin increase and a fee-manager decrease both apply at once) already pass.
  - The green tests check that:
    - reinstate works, and works while paused;
    - only the admin can reinstate;
    - payer and owner cancels can't be reinstated, nor can a live or unknown subscription;
    - the window closes after 7 days;
    - a sub reinstated after 6 missed daily periods is charged once;
    - a fee increase can't be committed early, commits after 24 hours, and can be cancelled by the admin;
    - a direct change clears a pending increase;
    - the fee ceiling still holds;
    - charges use the committed fee while an increase is pending.
- **Updated:**
  - `StrimzSubscriptions.t.sol`: `test_chargerCanCancel` is now `test_cancellerCanCancel`, and `test_chargerSecondCancelReverts` is now `test_cancellerSecondCancelReverts`. They use a scheduler that holds both roles and also check `operatorCancelledAt`.
  - `FeeManager.t.sol`: `test_feeManagerMovesAFreeMerchantToStarterThenGrowth` commits Free to Starter after the delay, and Starter to Growth still applies at once.
  - `AdminHandoff.t.sol` checks that the scheduler holds `CANCELLER_ROLE`, the relayer doesn't, and `ADMIN_ROLE` administers it.
  - `SubscriptionsInvariants` gains operator-cancel and reinstate actions. Its three invariants hold over 256 runs and 128,000 calls, with 0 reverts.
- `./scripts/preflight.sh` passes in full.

## Sizes

| Contract            | Runtime (B) | Margin (B) |
| ------------------- | ----------- | ---------- |
| StrimzSubscriptions | 20,498      | 4,078      |
| StrimzRegistry      | 14,507      | 10,069     |
