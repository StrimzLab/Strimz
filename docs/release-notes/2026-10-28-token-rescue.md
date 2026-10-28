---
date: 2026-10-28
feature: The Safe can return tokens sent straight to Payments or Subscriptions
scope: feature
scenario-impact: needs_automation
---

# Payments and Subscriptions: return tokens sent by mistake

If someone sends USDC or EURC straight to the Payments or Subscriptions address, outside any checkout, the Safe can now send it back. Before this, those tokens were stuck for good. A rescue can't touch merchant money or Strimz fees: payments go straight to the merchant's payout address and to `FeeCollector`, and neither contract keeps a balance between transactions. Tests check this after every payment and charge.

Refs #383 (epic #387). ADR: [ADR-2026-10-28-token-rescue](../adr/ADR-2026-10-28-token-rescue.md).

This changes `StrimzPayments` and `StrimzSubscriptions`, which can't be upgraded, so it takes effect at the #142 redeploy. Anything sent to the current testnet contracts stays where it is.

## What shipped

- **`rescue(address token, address to, uint256 amount)`** on both contracts (selector `0x20ff430b`):
  - only `ADMIN_ROLE` can call it, which is the Safe and the timelock after the handoff;
  - it's `nonReentrant` and works while paused;
  - it reverts on a zero `to` (`Payments__ZeroAddress()`, new, selector `0x17568d6d`, and the existing `Subscriptions__ZeroAddress()`) and on a zero `amount`.
- **New event:** `TokensRescued(address indexed token, address indexed to, uint256 amount, address indexed by)`, topic `0x4346967acdc47fe6a9e5e39320a4a816384f7f08c6e22d1f66c5ce55906aa748`.
- **Invariant tests:** `test/invariant/SubscriptionsInvariants.t.sol` runs random creates, charges, cancels and time jumps and checks three things after each step:
  - Subscriptions holds no balance;
  - the merchant has exactly the net charged;
  - `FeeCollector` has, and has accrued, exactly the fees charged.

  The existing `PaymentsInvariants` suite already checks that Payments holds nothing.

## How to return a mistaken transfer

1. Find the transfer to the contract address on the explorer and note the sender, the amount and the tx hash.
2. Check that the contract's token balance covers it. Anything the contract holds arrived this way.
3. From the Safe, call `rescue(token, sender, amount)` on that contract, with the tx hash in the transaction note.

## Ships with #142

1. **Indexer:**
   - add `TokensRescued` to the Payments and Subscriptions ABIs;
   - record it as an on-chain audit row with an admin alert, the same as role and pause events ([ADR-2026-10-16-onchain-admin-monitoring](../adr/ADR-2026-10-16-onchain-admin-monitoring.md));
   - add a projector test.
2. **Ops runbook:** add the steps above.

## Verification

- **Red:** `test/TokenRescue.t.sol` didn't compile on the old contracts. `rescue` didn't exist, so stray tokens had no way out.
- **Green:**
  - The admin returns the exact amount from each contract, and the call emits `TokensRescued`.
  - It works while paused.
  - A stranger, `DEFAULT_ADMIN_ROLE` alone and `CHARGER_ROLE` all revert with `AccessControlUnauthorizedAccount`.
  - A zero recipient and a zero amount revert.
  - A `payWithAuthorization` made while stray tokens sit in Payments pays the merchant and the fee exactly and leaves the stray amount for the rescue.
- `SubscriptionsInvariants`: 3 invariants at 256 runs and 128,000 calls, with no reverts.
- `./scripts/preflight.sh` passed in full: 263 contract tests and 6 Arc testnet fork tests.
