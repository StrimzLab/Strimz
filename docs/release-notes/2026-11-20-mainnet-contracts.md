---
date: 2026-11-20
feature: Contract fixes before mainnet (audit M-02, L-08, L-03/L-06, L-12), signup nonce on the event, gasless subscriber cancel, fee-change docs
scope: fix
scenario-impact: none
---

# Contract fixes before mainnet

ADR: [ADR-2026-11-19-mainnet-audit-fixes](../adr/ADR-2026-11-19-mainnet-audit-fixes.md).

**Must go live together with the new contracts.** Checkout now signs the new subscription intent, which the current testnet contract refuses. Redeploy with `docs/runbooks/testnet-redeploy.md`, set the new addresses, then release the apps.

## Contracts

- **M-02 (#480): expired signups.** `permitAndCreateSubscription` reverts with `Subscriptions__PermitExpired(deadline)` after the signed deadline. That now holds on the allowance path too, so an old, unsubmitted intent can't enrol a payer who already has an allowance.
- **L-08 (#481): the signup names the payer.** `SubscriptionIntent` starts with `address payer`, so one signature can't enrol a sibling smart wallet controlled by the same key. `subscriptionIntentDigest` takes `payer` first.
- **L-03/L-06 (#482): a sale freezes payout changes.**
  - `transferMerchantOwnership` cancels a pending payout change.
  - `setPayoutAddress` and `commitPayoutAddress` revert with `Registry__OwnershipTransferPending` until the transfer is accepted or cancelled.
- **L-12 (#483): a payer's cancel after an operator cancel.** The payer's `cancel` no longer reverts. It clears `operatorCancelledAt` and emits `SubscriptionCancelConfirmedByPayer`, so `reinstate` can't restart billing.
- **#497: plan attribution, on-chain half.** `SubscriptionCreated` ends with `bytes32 intentNonce`: the signed nonce, or zero for a direct `createSubscription`. The indexer decodes both the new event and the old one, which has no nonce.
- **#499: gasless subscriber cancel, on-chain half.**
  - `cancelWithSig(subscriptionId, deadline, signature)` takes the payer's EIP-712 `CancelSubscription`, from an EOA or an ERC-1271 wallet, and records a payer cancel that can't be reinstated.
  - `cancelDigest` exposes the digest.

## Apps and packages

- **`@strimz/sdk` (minor, breaking):** `SubscriptionIntentParams.payer` is now required. New `buildCancelSubscriptionTypedData`.
- **Checkout** signs the payer into the intent.
- **Regenerated ABIs:** the API relay and the indexer. There's also a legacy `StrimzSubscriptionsV1.abi.json`, so old testnet history still decodes. The indexer's `SubscribedTopics` now matches every signature of a subscribed event.
- **Scripts and tests:** `Digests.s.sol` and `e2e.sh` use the new digest and event signature, and so do the full-stack e2e helpers.

## Docs

- **Fees:** Strimz may raise its fee, for example when network costs go up, but never above the account's on-chain fee ceiling, and no ceiling exceeds 5%. Automatic increases wait 24 hours. See `guides/subscriptions` and `dashboard/settings`. The website pricing page is unchanged.
- **Ownership transfer:** nominating cancels a pending payout change, and payout changes are frozen until the handover ends. See `dashboard/settings` and `docs/runbooks/merchant-ownership-transfer.md`.
- **Intents:** the subscription-intent docs mention the payer and the deadline.

## Tests

- `test/MainnetAuditFixes.t.sol` has 17 tests. The four audit findings were written red first and fail on the old contracts. The rest cover the event nonce and `cancelWithSig`: EOA, ERC-1271, a stranger's signature, expiry, replay, the wrong id, and no charge after a cancel.
- `ContractPermissionGaps.test_acceptanceEmitsPayoutCancellationBeforeAcceptance` is replaced by `test_transferStartCancelsPendingPayoutChangeFirst`, because the cancellation moved to nomination.
- Also covered: SDK type-string and cancel-builder tests, a checkout test for the payer in the intent, and indexer decoder tests for the new and V1 `SubscriptionCreated`.
