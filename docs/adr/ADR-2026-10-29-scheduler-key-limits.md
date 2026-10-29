# ADR: Undoable operator cancels and delayed fee increases for the scheduler key

- **Status:** Accepted 2026-10-29
- **Date:** 2026-10-29
- **Scope:**
  - `StrimzSubscriptions` (immutable, takes effect at the #142 redeploy) and `StrimzRegistry` (UUPS, deployed fresh with #142).
  - Their interfaces, `StrimzAccessControl`, the admin handoff role table and its verify step, the contracts README and the tests.
  - The scheduler, indexer and API changes ship with #142.

## Context

Issue #378, from the 2026-10-28 audit. The scheduler's hot wallet holds two powers that a leaked key could abuse.

1. **`CHARGER_ROLE` on Subscriptions also lets it `cancel` any subscription** (`StrimzSubscriptions.sol:337`). A cancel is final, so a leaked key could end every subscription with no way back.
2. **`FEE_MANAGER_ROLE` on Registry lets it `setFeeBps` on any merchant at once**, up to that merchant's `maxFeeBps`. Every merchant registers with `PLAN_FEE_CEILING_BPS` (50 bps), so a leaked key could raise every merchant to 0.5% immediately.

The issue proposed taking both powers away. Both are in use:

- **Merchant cancels:** a merchant cancels through the API (`subscriptions.service.ts:87`), and the API queues `subscription.cancel-onchain`. The scheduler's agent-action worker then sends `cancel` with its key, because Strimz holds no merchant key and API-key cancels carry no wallet signature.
- **Plan upgrades:** the plan-upgrade cron calls `setFeeBps` when a merchant's volume earns a new plan. Free to Starter raises the fee from 0 to 50 bps, and Starter to Growth lowers it from 50 to 40 bps.

On the issue, the maintainer chose to make operator cancels undoable and to delay fee increases by 24 hours.

## Decision

### Subscriptions: a separate cancel role, and operator cancels the Safe can undo

1. **New role** `CANCELLER_ROLE = keccak256("STRIMZ_CANCELLER_ROLE")` in `StrimzAccessControl`.
   - The constructor grants it to `admin` and makes `ADMIN_ROLE` its role admin, the same as `CHARGER_ROLE`.
   - `CHARGER_ROLE` keeps `batchCharge` and loses `cancel`.
2. **`cancel`:**
   - The payer or the merchant owner cancels as today, and their cancel is final.
   - A caller with `CANCELLER_ROLE` (and neither payer nor owner) also cancels, but the cancel is recorded in a new `mapping(uint256 => uint64) operatorCancelledAt`. It is appended to the ERC-7201 `Storage`.
   - `SubscriptionCancelled(subscriptionId, by)` is unchanged.
3. **New `reinstate(uint256 subscriptionId)`:**
   - Only `ADMIN_ROLE` can call it, which is the Safe or the timelock. It works while paused.
   - It succeeds only for an operator cancel no older than `REINSTATE_WINDOW = 7 days`.
   - It clears `cancelled` and `operatorCancelledAt` and emits `SubscriptionReinstated(subscriptionId, by)`.
   - It reverts with:
     - `Subscriptions__NotReinstatable(subscriptionId)` for a payer or owner cancel, a sub that isn't cancelled, or an unknown sub;
     - `Subscriptions__ReinstateWindowClosed(subscriptionId)` once 7 days have passed.
   - After 7 days an operator cancel is final too, so state can't stay open forever.
4. **Charging after a reinstate:** `nextChargeAt` is left as it was. The existing `_charge` skips missed periods (`periodsSkipped`), so the payer is charged once for the current period and never back-billed for the gap.
5. **New view:** `operatorCancelledAt(uint256) returns (uint64)`.

### Registry: fee increases by `FEE_MANAGER_ROLE` wait 24 hours

6. **`setFeeBps` from an `ADMIN_ROLE` caller** applies at once, as today, and clears any pending increase.
7. **`setFeeBps` from a caller with only `FEE_MANAGER_ROLE`:**
   - A fee at or below the current one applies at once (`MerchantFeeBpsUpdated`) and clears any pending increase.
   - A higher fee is stored as pending, in a new appended `mapping(uint256 => PendingFee) pendingFees` with `{ uint16 feeBps; uint64 effectiveAt; }`. It takes effect after `FEE_INCREASE_DELAY = 24 hours`, and `MerchantFeeIncreaseScheduled(merchantId, feeBps, effectiveAt)` is emitted.
   - The existing `MAX_FEE_BPS` and `maxFeeBps` checks run first in both cases.
8. **New `commitFeeBps(uint256 merchantId)`:** anyone can call it once `effectiveAt` has passed. It applies the pending fee, emits `MerchantFeeBpsUpdated` and clears the pending entry. It reverts with `Registry__NoPendingFeeChange()` or `Registry__FeeChangeNotDue()`.
9. **New `cancelFeeIncrease(uint256 merchantId)`:** `ADMIN_ROLE` only. It emits `MerchantFeeIncreaseCancelled(merchantId)`.
10. **New view:** `pendingFeeOf(uint256) returns (uint16 feeBps, uint64 effectiveAt)`. `getMerchant` and the `Merchant` struct don't change, so `Payments` and `Subscriptions` keep charging the committed fee.

### Handoff

11. **Role table:**
    - The scheduler gets `CHARGER_ROLE` and `CANCELLER_ROLE` on Subscriptions, and keeps `FEE_MANAGER_ROLE` on the Registry.
    - `_roles()` gains `CANCELLER_ROLE`, so `renounceAll` and `verify` cover it. The table grows from 35/38 grants to 36/39.
    - `_checkServiceRoleAdmins` also checks that `CANCELLER_ROLE` is administered by `ADMIN_ROLE`.

### Ships with #142 (app switch)

- **Scheduler:**
  - The plan-upgrade cron schedules an increase, then calls `commitFeeBps` on a later tick once it is due.
  - It moves `Merchant.tier`, writes the audit entry and emails the merchant only after the fee on chain matches the new plan.
  - Decreases work as today.
  - The agent-action cancel worker needs no change, since the scheduler holds `CANCELLER_ROLE`.
- **Indexer:**
  - `SubscriptionReinstated` sets the subscription back to `active` and writes an audit row.
  - `MerchantFeeIncreaseScheduled` and `MerchantFeeIncreaseCancelled` write audit rows.
  - All three raise admin alerts, so a burst of operator cancels or scheduled increases shows up immediately (#380 covers the rate alert).
- **API:** a reinstated subscription fires `subscription.reactivated` to the merchant.

## Diagram

```mermaid
sequenceDiagram
    participant K as Scheduler key
    participant S as Subscriptions
    participant R as Registry
    participant Safe
    K->>S: cancel(id) [CANCELLER_ROLE]
    Note over S: cancelled, operatorCancelledAt = now
    Safe->>S: reinstate(id) within 7 days
    Note over S: active again; next charge covers the current period only
    K->>R: setFeeBps(m, 50) from 0 [FEE_MANAGER_ROLE]
    Note over R: pending 50, effectiveAt = now + 24h
    Safe-->>R: cancelFeeIncrease(m) (if it was not expected)
    K->>R: commitFeeBps(m) after 24h
    Note over R: feeBps = 50, MerchantFeeBpsUpdated
```

## Consequences

- **Leaked key, cancels:** the attacker can still cancel subscriptions, but for 7 days the Safe can reinstate every one of them. Payers aren't charged for the gap.
- **Leaked key, fees:** the attacker can lower fees at once, which costs Strimz revenue but not merchants. A raise waits 24 hours in public view, and the Safe can cancel it.
- **Free to Starter:** the 50 bps fee starts about a day later than today. Starter to Growth is unchanged.
- **Merchant-requested cancels** are reinstatable for 7 days. Only an `ADMIN_ROLE` holder can reinstate, and a payer can always cancel again themselves.
- **Size:** Subscriptions grows by a role, a mapping, a function and an event, and must stay within its 5,009 B margin. The Registry grows by one mapping, three functions and two events.

## Alternatives considered

- **Separate cancel role only:** while the role sits on the same server, a breach still gets it, and cancels stay final.
- **Merchant signs each cancel:** strongest, but cancelling with an API key stops working on chain.
- **Safe applies every fee change:** each plan upgrade would wait on signers, so Starter to Growth merchants overpay until someone signs.
- **Rely on alerts only:** damage is detected but can't be undone.
- **Delay every fee change, including decreases:** decreases only help merchants, so delaying them protects nothing.

## Verification

- **Red, on `main`:**
  - `CHARGER_ROLE` alone cancels a subscription (expected `Subscriptions__NotSubscriptionParty`).
  - A `FEE_MANAGER_ROLE` increase applies at once (expected the fee to stay unchanged until committed).
  - The new functions (`reinstate`, `commitFeeBps`, `cancelFeeIncrease`) are added as declarations first, so the behaviour tests compile and fail on behaviour.
- **Green:**
  - Operator cancel then reinstate charges once for the current period.
  - Reinstate is refused for payer and owner cancels and after 7 days, and only `ADMIN_ROLE` can call it.
  - A decrease by the fee manager applies at once; an increase applies only via `commitFeeBps` after 24 hours, and the Safe can cancel it.
  - An admin `setFeeBps` is immediate.
  - The handoff tests grant and verify `CANCELLER_ROLE`.
  - The existing tests pass.
- **Invariant:** `SubscriptionsInvariants` gains operator cancel and reinstate actions, and its three invariants still hold.
- `./scripts/preflight.sh` passes in full.
