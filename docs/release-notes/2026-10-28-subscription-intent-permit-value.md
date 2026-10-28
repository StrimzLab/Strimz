---
date: 2026-10-28
feature: Subscription intents sign the permit amount, and an approval below one charge is refused
scope: fix
scenario-impact: needs_automation
---

# Subscriptions: the intent signs the permit amount

A signed subscription intent now works only with the approval amount the payer signed. Before this, anyone holding the payer's intent signature could enrol them with a zero approval. The subscription could never be charged, and the payer's real signup then failed with "intent already used". Subscriptions whose approval can't cover one charge are now refused too.

Refs #374 (epic #387). ADR: [ADR-2026-10-28-subscription-intent-permit-value](../adr/ADR-2026-10-28-subscription-intent-permit-value.md).

This changes `StrimzSubscriptions` only. The contract can't be upgraded, so nothing changes on chain until the #142 redeploy. The apps keep signing the deployed contract's type until then.

## What shipped

- **New EIP-712 type:**
  `SubscriptionIntent(uint256 merchantId,address token,uint256 amount,uint32 interval,uint64 startAt,uint64 endAt,uint256 permitDeadline,uint256 permitValue,bytes32 nonce)`.
  - Type hash: `0xf9b4881ec4152941f7459654b43ca8fbb4e8c7a8778bbdf1bff66dd02fed677a`.
  - The domain is unchanged.
  - The contract hashes `permitData.value` into `permitValue`, so any other value fails with `Subscriptions__InvalidIntent()`.
- **New error:** `permitAndCreateSubscription` reverts with `Subscriptions__PermitBelowAmount(uint256 value, uint256 amount)` (selector `0x7f825d82`) when `permitData.value < amount`. This is checked before the intent.
- **Digest view:** `subscriptionIntentDigest` takes `uint256 permitValue` after `permitDeadline`. The new signature is `subscriptionIntentDigest(uint256,address,uint256,uint32,uint64,uint64,uint256,uint256,bytes32)`, selector `0x2fb20630`.
- **Unchanged:** the `permitAndCreateSubscription` selector stays `0x54d2fac0`, and the front-run-safe allowance fallback is kept.
- **Scripts:** `script/Digests.s.sol` and `script/e2e.sh` sign the new type.

## Ships with #142

These join the lists in [2026-10-03-subscription-intent-nonce](2026-10-03-subscription-intent-nonce.md) and [2026-10-23-erc1271-payers](2026-10-23-erc1271-payers.md).

1. **SDK:** in `packages/sdk/src/eip712/subscription-intent.ts`, add `permitValue: bigint` to `SubscriptionIntentParams` and `{ name: 'permitValue', type: 'uint256' }` after `permitDeadline` in `SUBSCRIPTION_INTENT_TYPES`, and pass it in the message. The type string must equal the one above. Add a `@strimz/sdk` changeset; it's breaking, since the field is new and required.
2. **Checkout:** `apps/web/src/hooks/use-subscription-checkout.ts` passes the same `permitValue` it signs in the permit. #384 decides what that value is.
3. **Relay revert decoding:** add `Subscriptions__PermitBelowAmount(uint256,uint256)` to `relay-revert.ts`.

## Verification

- **Red:** `test/SubscriptionIntentPermitValue.t.sol` on the old contract.
  - 3 of 5 failed with `next call did not revert as expected`. The zero-value front-run, a mismatched permit value with an existing allowance, and a permit below one charge all enrolled the payer.
  - The other 2 are guards and passed: a bounded permit signed in the intent enrols, and a front-run with the payer's own permit leaves the approval they signed.
- **Green:**
  - All 5 pass.
  - The typehash pin test now checks the new type string and a non-max `permitValue` against `subscriptionIntentDigest`.
  - The ERC-1271 wallet subscription test passes with the new type.
  - 235 contract tests pass.
- `./scripts/preflight.sh` passed in full: 235 contract tests and 6 fork tests on Arc testnet USDC, including the ERC-1271 wallet subscription.
