---
date: 2026-10-31
feature: The apps switch to the redeployed contracts
scope: feature
scenario-impact: needs_automation
---

# The apps switch to the redeployed contracts

This is the app half of every contract change made for the #142 redeploy. It ships the "Ships with #142" lists from earlier release notes in one change. Merge it only when the new contracts are deployed and their addresses are set: the apps then match the new contracts and no longer match the old ones.

Closes #372, #373 and #384. Refs #142, #287, #374, #375, #378, #383, #386 (epic #387). ADR: [ADR-2026-10-30-arc-redeploy-app-switch](../adr/ADR-2026-10-30-arc-redeploy-app-switch.md).

## What shipped

### Checkout and relay

- **Relay ABIs come from the build (#372).**
  - `scripts/generate-abis.sh` now also writes `apps/api/src/modules/relay/generated/contracts.ts`. It holds `payWithAuthorization`, `permitAndCreateSubscription` and every Payments, Subscriptions, Registry and TokenWhitelist error.
  - `--check` covers it in CI and preflight.
  - The hand-written `abi.ts` is gone, and relay reverts decode by name from the generated errors.
- **Signatures are `bytes` (ERC-1271, #287).**
  - **Relay input:** each signature field accepts a `{v, r, s}` object, packed as r ‖ s ‖ v, or a hex string of up to 4,096 bytes.
  - **Checkout:** the hooks post the wallet's signature as it came. The one exception is a 0/1 `v`, which is raised to 27/28, and only for an ordinary wallet.
  - **Pay page:** a smart-contract wallet can now pay, so the "This wallet type can't pay here yet" notice and the `unsupported_wallet` checkout error are gone. The code stays in the published type, marked as no longer sent.
- **Relay gas:**
  - The relay estimates gas instead of using a fixed limit.
  - The limit is the larger of the fixed floor and the estimate plus 30%.
  - An estimate above 600,000 gas is refused with `relay_gas_too_high`.
- **SubscriptionIntent gains `permitValue` and `nonce` (#373, #374).**
  - The SDK type matches the contract. A test compares it with the type string in `StrimzSubscriptions.sol`, and another does the same for `PayIntent`.
- **One intent nonce per checkout (duplicate signups):**
  - `subscriptionIntentNonce(planId, payer, permitNonce)` is new in `@strimz/shared-crypto`. The checkout signs it.
  - The relay reads the token's `nonces(payer)` and refuses any other nonce with `intent_nonce_mismatch`.
  - A signup retried while the first is still pending carries the same nonce, so the contract rejects the second one.
- **Permit amount (#384):** it stays unlimited. The checkout now says: "You approve once in your wallet. Only the amount and schedule shown can be charged, and you can cancel at any time."
- **Payer messages:** `intent_nonce_mismatch` and `relay_gas_too_high` have plain-English messages.

### Delisted tokens (#375)

- **Database:** a new `SubscriptionChargeOutcome` value, `token_not_allowed`.
- **Indexer:** outcome 11 is stored as `token_not_allowed`. It doesn't count as a payment failure, so the subscription stays active.
- **Shared types:** the outcome list has the new value. A test now compares it with the database enum.
- **Scheduler:** `isChargeDue` also checks `tokenWhitelist().isWhitelisted(token)`, so it doesn't send a charge that can only be skipped.
- **Dashboard (#400):** no screen lists skipped charges today. The subscription page shows completed charges only, and the API doesn't expose charge attempts. #400 stays open; it needs that list first.

### Scheduler key limits (#378)

- **plan-upgrade:** a fee increase is two steps.
  1. One tick calls `setFeeBps`, which schedules the increase.
  2. A later tick calls `commitFeeBps` once `pendingFeeOf` is due by chain time.

  The plan, the audit row and the email change only after that. A decrease still applies at once.

- **Indexer, `SubscriptionReinstated`:**
  - moves the subscription back to `active` and clears the cancel fields;
  - writes a `subscription.reinstated_onchain` audit row and an admin alert;
  - queues `subscription.reactivated` to the merchant.
- **Indexer, `MerchantFeeIncreaseScheduled` and `MerchantFeeIncreaseCancelled`:** each writes an audit row and an admin alert. They don't send the merchant a security email; that's still only for payout and ownership changes.
- **Webhooks:** `subscription.reactivated` is a new event type, with the subscription as its payload. It's in the database enum, shared types, shared config, the scheduler outbox, the dashboard's event picker and the docs.
- **Admin alert email:** new descriptions for:
  - a scheduled fee increase (new fee and when it takes effect);
  - a cancelled fee increase;
  - a reinstated subscription;
  - rescued tokens.

### Token rescue (#383)

- **Indexer:** `TokensRescued` writes a `contract.tokens_rescued` admin audit row and an alert.
- **Runbook:** `docs/runbooks/token-rescue.md`.

### Removed and updated

- **ABIs:** `apps/indexer/internal/abi/deployed-only/` is gone, along with the indexer's handling of `MerchantMaxFeeBpsLowered`, which only the retired Registry emits. The merchant's max fee is still set when the merchant links.
- **`e2e.sh` stage 4:** it already signed `permitValue` and `nonce` (#374), so it needed no change.
- **Runbook `unexpected-admin-alert.md`:**
  - the fee-increase row is current;
  - new entries for rescued tokens and reinstated subscriptions;
  - a "Leaked scheduler key" section.
- **Docs:**
  - the meta-tx flow and on-chain architecture pages describe the new intent fields and ERC-1271;
  - the React SDK and embed pages drop `unsupported_wallet`;
  - the webhooks and lifecycle pages list `subscription.reactivated`.
- **Changesets:**
  - `@strimz/sdk` and `@strimz/shared-crypto` (minor; breaking for the SDK's `SubscriptionIntentParams`);
  - `@strimz/shared-types` and `@strimz/shared-config` (minor).

## For operators

1. **Deploy order:**
   1. Redeploy the contracts (#142).
   2. Apply the migration `20261031120000_redeploy_enum_values`.
   3. Set the new addresses and `START_BLOCK`.
   4. Deploy the indexer, the API, the scheduler and the web app from this change.
2. **Gas:** smart-wallet signups can cost the relayer up to 600,000 gas each, above the old fixed limits.
3. **Plan upgrades:** a Free merchant reaching Starter or Growth now moves plan about 24 hours after the threshold, when the new fee goes live.

## Tests

- **Red, then green:**
  - the relay selector test (`0x08aeff48`, `0x54d2fac0`);
  - the relay service, DTO and probe tests for `bytes` signatures, the nonce and the gas limit;
  - the SDK type-string tests;
  - the shared-crypto nonce vector, computed independently with `cast`;
  - the web signing, wallet-signature, checkout copy, payer message and pay-page wiring tests;
  - the indexer outcome map, the `token_not_allowed` store e2e test, and the new event decode and projection e2e tests;
  - the scheduler chain service tests (whitelist, pending fee, commit, block time);
  - the plan-upgrade e2e tests for the two-step increase;
  - the contract-alerts and webhook-outbox e2e tests;
  - the shared-types charge-outcome drift test.
- **Updated to the new shapes:** the existing relay unit and e2e tests (named in the earlier release notes).
- **Suites:** API, web, scheduler and indexer, unit and e2e. `./scripts/preflight.sh` passes in full.
- **After the redeploy (#326):** a hosted payment, a subscription signup, a retried signup rejected as a duplicate, and a charge on testnet, with their transaction hashes.
