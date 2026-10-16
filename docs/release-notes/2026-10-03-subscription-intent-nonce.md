---
date: 2026-10-03
feature: Subscription intents carry a single-use nonce and a front-run permit no longer blocks enrolment
scope: fix
scenario-impact: needs_automation
---

# Subscriptions: single-use intent nonce and front-run-safe permit

A signed subscription intent can now be used once. A second enrolment with the same
signed intent reverts, whatever permit comes with it. Someone who submits the payer's
permit to the token first no longer blocks the enrolment: it goes through when the
allowance the permit granted is already in place.

Refs #130 (item 6). ADR:
[ADR-2026-10-03-contract-permission-gaps](../adr/ADR-2026-10-03-contract-permission-gaps.md),
decision 6.

This changes `StrimzSubscriptions` only. The contract is not upgradeable, so nothing
changes on chain until the redeploy in #142. The SDK, web checkout, API relay and
indexer keep the old ABI in this change, because switching them before the redeploy
would break enrolment against the deployed testnet contract. They ship with #142, as
listed below.

## What was wrong

- `SubscriptionIntent` had no nonce and nothing marked an intent used. The only reuse
  guard was the token's permit nonce, so any later permit from the same owner with the
  same deadline revived an old intent and enrolled the payer in a second subscription.
- The permit signature is public once submitted. Anyone could call `token.permit` with
  it first; the relayer's `permitAndCreateSubscription` then reverted inside `permit`
  and the subscription was never created.

## What shipped

- The EIP-712 type is now
  `SubscriptionIntent(uint256 merchantId,address token,uint256 amount,uint32 interval,uint64 startAt,uint64 endAt,uint256 permitDeadline,bytes32 nonce)`.
  Type hash `0xe0ecd754f22a8f29e2e5ae443cf4531fff1703b401e4dc0396c65fbba4026adf`.
  Domain unchanged: `EIP712("StrimzSubscriptions", "1")`.
- `permitAndCreateSubscription` takes `bytes32 nonce` after `endAt`:
  `permitAndCreateSubscription(uint256,address,uint256,uint32,uint64,uint64,bytes32,(address,uint256,uint256),(uint8,bytes32,bytes32),(uint8,bytes32,bytes32))`,
  selector `0x49875e38` (was `0xef6b5f1d`).
- `subscriptionIntentDigest` takes `bytes32 nonce` last:
  `subscriptionIntentDigest(uint256,address,uint256,uint32,uint64,uint64,uint256,bytes32)`,
  selector `0x758a3ec0`.
- Storage: `mapping(address payer => mapping(bytes32 nonce => bool used)) usedIntentNonces`
  appended to `Storage`. After the intent signature is verified, a used nonce reverts
  with the new error `Subscriptions__IntentAlreadyUsed(bytes32 nonce)` (selector
  `0x195bba3d`); otherwise the nonce is marked used before `permit` is called. Nonces are
  scoped to the payer. No view exposes the map.
- `permit` is called in a `try`. If it reverts and
  `allowance(permitData.owner, this) < permitData.value`, the token's revert data is
  re-raised unchanged with OpenZeppelin's `LowLevelCall.bubbleRevert`. If the allowance
  already covers `permitData.value`, enrolment continues.
- `createSubscription` is unchanged.

## Ships with #142

Each of these moves to the new ABI in the same change that points the apps at the
redeployed contract.

1. `packages/sdk/src/eip712/subscription-intent.ts`: add `` nonce: `0x${string}` `` to
   `SubscriptionIntentParams`, append `{ name: 'nonce', type: 'bytes32' }` as the last
   entry of `SUBSCRIPTION_INTENT_TYPES.SubscriptionIntent`, and pass `nonce` in the
   message of `buildSubscriptionIntentTypedData`. The type string must equal the one
   above. Add a `@strimz/sdk` changeset (breaking: new required field).
2. `apps/web/src/hooks/use-subscription-checkout.ts`: generate a 32-byte nonce, pass it
   to `buildSubscriptionIntentTypedData`, and send it as `nonce` in the submit body and
   in the `SubmitBody` type. See the retry note below on how the nonce is chosen.
3. `apps/web/src/app/api/checkout/sessions/[sessionId]/submit/route.ts`: add
   `nonce: bytes32Schema` to `subscriptionBodySchema` and forward it.
   `apps/web/src/lib/strimz-bff.ts`: add `nonce` to the subscription submit input type.
4. `apps/api/src/modules/relay/relay.dto.ts`: add `nonce: bytes32Schema` to
   `submitSubscriptionInputSchema`. `relay.types.ts`: add `` nonce: `0x${string}` `` to
   `PermitAndCreateSubscriptionInput`. `relay.controller.ts`: pass `body.nonce` through.
   `relay.service.ts`: pass `input.nonce` as the 7th argument (after `input.endAt`) in
   `submitPermitAndCreateSubscription`.
5. `apps/api/src/modules/relay/abi.ts`: insert `{ name: 'nonce', type: 'bytes32' }`
   after `endAt` in `permitAndCreateSubscriptionAbi`.
6. `apps/api/src/modules/relay/relay-revert.ts`: add
   `'error Subscriptions__IntentAlreadyUsed(bytes32 nonce)'` to `relayRevertAbi`.
7. `apps/api/src/modules/relay/relay.service.ts`, `assertAttemptReplaceable`: the line
   `if (data.reason === 'permitAndCreateSubscription') return` lets a new subscription
   attempt replace a failed job whose broadcast transaction is still pending. That was
   safe only because both attempts signed the same token permit nonce, so at most one
   could land. With the new contract the second attempt's permit fails, the first
   attempt's allowance covers the value, and the second enrolment succeeds: a duplicate
   subscription. Either keep one intent nonce per checkout attempt across re-signs (the
   contract then rejects the second with `Subscriptions__IntentAlreadyUsed`), or stop
   treating a pending subscription broadcast as replaceable. This needs a decision
   before #142.
8. API tests that build subscription bodies or calldata:
   `apps/api/test/unit/modules/relay/relay-service.test.ts`,
   `relay-controller.test.ts`, `relay-checkout-idempotency.test.ts`,
   `relay-attempt-rules.test.ts`, and the web BFF test
   `apps/web/src/__tests__/checkout-relay-bff.test.ts`.
9. `packages/queue-contracts/src/fixtures.ts`: no change. `callData` is opaque there.
10. `apps/indexer/internal/abi/StrimzSubscriptions.abi.json`: carries no function or
    error entries for this path today, so no change is required. Regenerate it from the
    new build if the indexer copies the full ABI.
11. `packages/contracts/script/e2e.sh` stage 4 still calls the signature without the
    intent signature, so it is already broken on `main`. It needs the intent signature
    and the nonce.
12. Docs that describe the intent fields: `apps/web/content/docs/concepts/meta-tx-flow.mdx`
    (field list for `SubscriptionIntent`, and "The intent's `nonce` is the same nonce
    the token authorization burns", which is true for payments only),
    `concepts/on-chain-architecture.mdx`, `sdks/react.mdx`, `subscriptions/plans.mdx`.

## Behaviour to know

- A payer who already holds an allowance to the new contract that covers
  `permitData.value` (for example from an earlier unlimited permit) is enrolled even when
  the new permit fails for another reason, such as an expired deadline or a bad
  signature. The intent signature and its single-use nonce still bind the enrolment.
- A reverted enrolment does not consume the nonce, because the mark is rolled back with
  the rest of the transaction.

## Verification

- Red on `main` (c19b4f2): `test_subscriptionIntentCannotBeReplayedWithLaterPermit`
  failed with `next call did not revert as expected`;
  `test_frontRunPermitDoesNotBlockSubscriptionEnrolment` failed with
  `ERC2612InvalidSigner(...)`.
- Green: `test/SubscriptionIntentNonce.t.sol` 9/9, `test/StrimzSubscriptionsPermit.t.sol`
  15/15, full forge suite 169/169.
- Not run: the Arc testnet check in the ADR. It needs the #142 redeploy.
