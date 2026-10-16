---
date: 2026-10-03
feature: Merchant ownership waits 24 hours, a new owner starts with no pending payout change, and admin agent suspension sticks
scope: fix
scenario-impact: needs_automation
---

# Contracts: ownership delay, admin cancel and agent suspension

Merchant ownership can no longer move in one block. The nominee can accept only 24 hours
after the nomination, and Strimz operations can cancel a pending ownership transfer or
payout change without being able to redirect anything. Accepting ownership now cancels
any payout change the previous owner left pending. An agent deactivated by an agent
admin can no longer reactivate itself.

Refs #130. ADR: [ADR-2026-10-03-contract-permission-gaps](../adr/ADR-2026-10-03-contract-permission-gaps.md)
([plain-English version](../adr/ADR-2026-10-03-contract-permission-gaps-for-dummies.md)).
This change ships items 1, 2 and 3 of the ADR. Items 4, 5 and 6 are deferred, see
[Deferred](#deferred).

## What was wrong

- A stolen merchant owner key could nominate a second wallet and accept in the same
  block. The real owner then lost the right to cancel the attacker's pending payout
  change, so the 24-hour payout delay protected nothing.
- A payout change the previous owner started stayed pending after a new owner accepted,
  and anyone could commit it once the delay passed (Buantum S/02).
- An agent's controller could undo an agent admin's deactivation in one call.

## What shipped

`StrimzRegistry`:

- `transferMerchantOwnership` records when the nominee may accept: now plus
  `PAYOUT_CHANGE_DELAY` (24 hours). A new nomination restarts the wait.
- `acceptMerchantOwnership` reverts with `Registry__OwnershipTransferNotDue()` before that
  time, and also when no time is recorded (a nomination made before the upgrade).
- `acceptMerchantOwnership` clears `pendingPayoutAddress` and `payoutChangeCommitAt`.
  When a change was pending it emits `MerchantPayoutChangeCancelled` before
  `MerchantOwnershipTransferAccepted`.
- New `adminCancelPayoutChange(uint256)` and `adminCancelOwnershipTransfer(uint256)`,
  `ADMIN_ROLE` only. They emit the existing cancel events and set no address.
- New view `pendingOwnerAcceptableAt(uint256) returns (uint64)`; `0` when nothing is
  recorded.
- Storage: `ownershipAcceptableAt` mapping appended to the ERC-7201 `Storage` struct.
  The `Merchant` struct and `getMerchant` are unchanged, so the deployed Payments and
  Subscriptions keep decoding it.

`StrimzAgentRegistry`:

- `deactivate` by an `AGENT_ADMIN_ROLE` holder marks the agent suspended. While
  suspended, `activate` by the controller reverts with `AgentRegistry__Suspended(agent)`
  and `isActive` returns false. `activate` by an agent admin clears the suspension. A
  controller's own deactivate and activate work as before.
- New view `isSuspended(address)`.
- Storage: `suspended` mapping appended to the ERC-7201 `Storage` struct. The `Agent`
  struct and events are unchanged.

Consumers:

- API `GET /v1/merchants/me/onchain-state` returns `pendingOwnerAcceptableAt` (Unix
  seconds, or `null` when the registry has none recorded).
- Dashboard On-chain policy panel shows when the nominee can accept, keeps Accept
  ownership disabled until then, and says a nomination without a recorded time must be
  made again.
- `apps/indexer/internal/abi/StrimzRegistry.abi.json` gains the two admin functions, the
  view and the error. No event changed, so the indexer decodes the same logs.
- Docs: `dashboard/settings.mdx` describes the 24-hour wait and the cleared payout change.
- Runbook: [merchant ownership transfer](../runbooks/merchant-ownership-transfer.md).

## Deploy

These items upgrade the existing proxies in place; no redeploy is needed for them. The
redeploy in #142 picks them up in the fresh proxies.

1. **Upgrade `StrimzRegistry`.** Deploy the new implementation and call
   `upgradeToAndCall(newImplementation, 0x)` on the proxy from an `UPGRADER_ROLE`
   holder. No initializer runs. The upgrade was checked with the OpenZeppelin upgrades
   validator against a copy of the current layout (`test/Upgradeability.t.sol`).
2. **Upgrade `StrimzAgentRegistry`** the same way. It is independent of step 1.
3. **Deploy the API**, only after step 1. The API now reads
   `pendingOwnerAcceptableAt`; against a registry without the upgrade that read reverts
   and the panel shows the "no on-chain merchant record yet" state.
4. **Deploy the web app** with or after the API.
5. **Indexer:** no deploy needed for this change; the new ABI file ships with the next
   indexer release.

After the upgrades:

- Any ownership nomination pending at upgrade time cannot be accepted. The owner must
  nominate again and wait 24 hours. Check for pending nominations before upgrading and
  tell those merchants.
- Agents that an agent admin deactivated before the upgrade are not suspended, because
  the flag did not exist. Their controllers can still reactivate them. If any of those
  deactivations must stick, an agent admin calls `deactivate` again after the upgrade.
- Operations follow the [runbook](../runbooks/merchant-ownership-transfer.md) for
  hand-overs and unexpected changes.

## Deferred

- **Items 4 and 5 (agent escrow pause and silent dispute)** follow the launch-scope
  decision in #145. If agent escrow stays out of launch, they are deferred with it.
- **Item 6 (subscription intent nonce and front-run permit)** conflicts with an
  in-flight change to the relay and checkout and will follow in its own change.
  `StrimzSubscriptions` is not upgradeable, so item 6 ships only through the redeploy in
  #142.

The red tests for items 4 to 6 are not in this change. They are kept for the change
that implements them.

## Behaviour change for merchants

Ownership transfers take 24 hours instead of minutes. A buyer of a merchant no longer
inherits a payout change the seller started.
