---
date: 2026-10-28
feature: Subscriptions in a token removed from the whitelist are skipped, not charged
scope: fix
scenario-impact: needs_automation
---

# Subscriptions: no charges in a token that is no longer whitelisted

Removing a token from the whitelist now stops recurring charges in it. A due subscription in that token is skipped with the new outcome `TokenNotAllowed`. When the token is added back, the next charge takes the current period only and the gap is never billed.

Refs #375 (epic #387). ADR: [ADR-2026-10-28-delisted-token-charges](../adr/ADR-2026-10-28-delisted-token-charges.md).

This changes `StrimzSubscriptions` only. The contract can't be upgraded, so nothing changes on chain until the #142 redeploy.

## What shipped

- **New outcome:** `ChargeOutcome.TokenNotAllowed`, value 11, added after `TransferFailed`. No existing value moved.
- **The check:** `_charge` calls `tokenWhitelist.isWhitelisted(sub.token)` after the `Ended` check. When it's false, it emits `SubscriptionChargeSkipped(subscriptionId, chargeAttemptId, 11)` and returns without:
  - spending the attempt id;
  - moving `nextChargeAt`;
  - touching any balance.
- **Gas:** measured over a 20-row `batchCharge`, about 1.4k gas per row once the whitelist is warm (+28,430 over 1,066,131). The first row in a transaction pays more, because the whitelist proxy is cold. The scheduler's batches are at most 100 rows, with viem estimating gas each time, so no limit changes.
- **Old indexers:** an indexer that predates this change records outcome 11 as `skipped` and doesn't treat it as a payment failure. The contract can go out before the app half without a crash.

## Ships with #142

1. **Database:** `packages/db/prisma/schema/enums.prisma`, add `token_not_allowed` to `SubscriptionChargeOutcome`, as a new migration.
2. **Indexer:** in `apps/indexer/internal/abi/events.go`, add `ChargeOutcomeTokenNotAllowed ChargeOutcome = 11`, plus its line in the order comment and `DBString() == "token_not_allowed"`. Keep it out of `IsPaymentFailure()`. Add a projector test that a skipped event with outcome 11 stores `token_not_allowed` and leaves the subscription's status alone.
3. **Shared types:** add `'token_not_allowed'` to the outcome list in `packages/shared-types/src/subscriptions.ts`, with a changeset.
4. **Scheduler:** the due sweep leaves out subscriptions whose token isn't whitelisted, so a removed token doesn't cost a transaction each sweep. Add a test on the real worker.
5. **Dashboard:** show `token_not_allowed` on a charge as "Skipped: token not accepted", not as a failure.

## Verification

- **Red:** `test/SubscriptionDelistedToken.t.sol` on the old contract. 3 tests failed because the delisted-token row came back `Charged` (`1 != 11`, and `SubscriptionCharged != expected SubscriptionChargeSkipped`). The enum-order test passed, since the stub value was already in place.
- **Green:**
  - A delisted-token row returns `TokenNotAllowed` and emits it.
  - The payer, merchant, `nextChargeAt` and the attempt id are untouched.
  - After the token is added back two intervals later, the next charge takes one period and emits `SubscriptionPeriodsSkipped(2)`.
  - A mixed batch charges only the allowed row.
  - `TokenNotAllowed == 11`.
  - 248 contract tests pass.
- `./scripts/preflight.sh` passed in full: 248 contract tests and 6 Arc testnet fork tests.
