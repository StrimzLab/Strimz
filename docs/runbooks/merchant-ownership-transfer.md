# Runbook: merchant ownership transfer

Use this when a merchant hands its on-chain merchant record to a new wallet, and when
operations see an ownership or payout change they did not expect.

Background: [ADR-2026-10-03-contract-permission-gaps](../adr/ADR-2026-10-03-contract-permission-gaps.md),
items 1 and 2 (Buantum S/02).

## Rules on the registry

These hold once the `StrimzRegistry` upgrade from #130 is live. Until then, see
[Before the upgrade](#before-the-upgrade).

- The nominee can accept ownership only `PAYOUT_CHANGE_DELAY` (24 hours) after the
  nomination. A new nomination restarts the 24 hours.
- Accepting ownership cancels any pending payout change and emits
  `MerchantPayoutChangeCancelled` before `MerchantOwnershipTransferAccepted`.
- During the wait, the current owner (`cancelOwnershipTransfer`) or an `ADMIN_ROLE`
  holder (`adminCancelOwnershipTransfer`) can stop the transfer.
- An `ADMIN_ROLE` holder can cancel a pending payout change
  (`adminCancelPayoutChange`). Admin functions only cancel. They never set an owner or a
  payout address.
- A nomination made before the upgrade cannot be accepted. The owner must nominate again
  and wait 24 hours.

## Hand-over

1. **Current owner: clear pending payout changes.** Open Settings, On-chain policy.
   Under Payout address, confirm there is no pending change. If there is one, cancel it
   or let it commit first. Do not hand over with a change pending.
2. **Current owner: nominate.** Under Ownership, enter the new owner's wallet address
   and click Nominate.
3. **Operations: check the nomination.** Confirm the `MerchantOwnershipTransferInitiated`
   event names the agreed address:

   ```bash
   cast call "$STRIMZ_REGISTRY_ADDRESS" "pendingOwnerOf(uint256)(address)" "$MERCHANT_ID" \
     --rpc-url "$ARC_TESTNET_RPC_URL"
   cast call "$STRIMZ_REGISTRY_ADDRESS" "pendingOwnerAcceptableAt(uint256)(uint64)" "$MERCHANT_ID" \
     --rpc-url "$ARC_TESTNET_RPC_URL"
   ```

   `pendingOwnerAcceptableAt` is a Unix timestamp. `0` with a pending owner means the
   nomination was made before the upgrade and must be made again.

4. **Wait 24 hours.** The panel shows when the nominee can accept. Either party, or
   operations, can stop the transfer during the wait.
5. **New owner: accept.** The new owner signs in with the nominated wallet, opens
   On-chain policy and clicks Accept ownership. Confirm on the panel that the owner
   changed and that there is no pending payout change.
6. **New owner: set its payout address.** Under Payout address, initiate the change to
   the new owner's address. It goes live 24 hours later; until then payments still go
   to the old payout address.

## Unexpected change

On any `MerchantOwnershipTransferInitiated` or `MerchantPayoutChangeInitiated` that the
merchant did not ask for:

1. Freeze the merchant so no new payments or charges settle to it:

   ```bash
   cast send "$STRIMZ_REGISTRY_ADDRESS" "setActive(uint256,bool)" "$MERCHANT_ID" false \
     --rpc-url "$ARC_TESTNET_RPC_URL" --private-key "$ADMIN_PRIVATE_KEY"
   ```

2. Cancel whatever is pending:

   ```bash
   cast send "$STRIMZ_REGISTRY_ADDRESS" "adminCancelOwnershipTransfer(uint256)" "$MERCHANT_ID" \
     --rpc-url "$ARC_TESTNET_RPC_URL" --private-key "$ADMIN_PRIVATE_KEY"
   cast send "$STRIMZ_REGISTRY_ADDRESS" "adminCancelPayoutChange(uint256)" "$MERCHANT_ID" \
     --rpc-url "$ARC_TESTNET_RPC_URL" --private-key "$ADMIN_PRIVATE_KEY"
   ```

   Each reverts with `Registry__NoPendingTransfer` or `Registry__NoPendingPayoutChange`
   when there is nothing to cancel.

3. Contact the owner out of band, through a channel other than the dashboard account,
   and agree on the next step. If the owner key is compromised, the owner nominates a
   fresh wallet and operations watch the 24-hour window, cancelling any competing
   nomination or payout change the attacker makes.
4. Unfreeze only when no unexpected change is pending:

   ```bash
   cast send "$STRIMZ_REGISTRY_ADDRESS" "setActive(uint256,bool)" "$MERCHANT_ID" true \
     --rpc-url "$ARC_TESTNET_RPC_URL" --private-key "$ADMIN_PRIVATE_KEY"
   ```

`ADMIN_PRIVATE_KEY` is the key of an `ADMIN_ROLE` holder on the registry. Use
`ARC_MAINNET_RPC_URL` on mainnet.

## Before the upgrade

On a registry that does not have the #130 upgrade yet, acceptance is immediate, a
pending payout change survives it, and the admin cancel functions do not exist. Until
the upgrade:

- Follow step 1 strictly: never hand over with a payout change pending.
- After accepting, the new owner checks the panel at once and cancels any pending payout
  change with Cancel pending.
- On an unexpected change, operations can only freeze the merchant (`setActive(false)`)
  and contact the owner. Only the current owner can cancel.
