# ADR: Every payment-failure skip advances the retry backoff

- **Status:** Accepted (approved by the maintainer, 2026-10-17)
- **Date:** 2026-10-17
- **Issue:** #297
- **Scope:**
  - `apps/indexer`: the `SubscriptionChargeSkipped` projection and its e2e tests.
  - `apps/scheduler`: one wrong comment in the subscription-due worker.
  - Subscription recovery and lifecycle docs.
  - No contract, migration, queue payload or webhook payload change.

## Context

Checked against `main` at `a8459a0`.

1. **The contract keeps the attempt id on purpose.** `_charge` marks `chargeAttemptId` used only
   just before the transfer (`StrimzSubscriptions.sol:417`). `RevokedApproval`,
   `InsufficientFunds` and `MerchantInactive` return earlier, so the id stays unspent and the
   comment at the top of `_charge` says these skips "stay retryable under the same deterministic
   id". Only `TransferFailed` burns it.
2. **So the worker resends the same id.** `subscription-due.worker.ts` walks attempt indexes and
   takes the first id the contract reports unused. After a balance or allowance skip, that is
   attempt 0 again. The worker's comment says the contract burns the id on every failure, which
   is wrong.
3. **The indexer counts a failure only for a new row.** `InsertSubscriptionChargeSkip`
   (`projections.go:669`) inserts with `ON CONFLICT ("chargeAttemptId") DO NOTHING`. The second
   skip under the same id inserts nothing, so it returns before the `subscription.charge_failed`
   outbox event and before the `retryCount` / `nextRetryAt` update.
4. **What that costs.** After the first failure `nextRetryAt` stays at +15 minutes in the past, so
   the sweeper (every 15 minutes) retries on every tick until the subscription lapses: about 192
   transactions over the 48h grace window, gas paid by Strimz. The merchant gets one
   `charge_failed` per period, and `charge.attemptNumber` is always 1.
5. **One row per attempt id is intended.** A success under an id that failed earlier upgrades
   that failed row (`InsertSubscriptionCharge`, `ON CONFLICT … WHERE status = 'failed'`), covered
   by `TestE2E_SubscriptionCharged_RetryUnderSameAttemptIdUpgradesFailedRow`.
6. **Replays.** The indexer can project the same log twice (restart from a checkpoint, reorg), so
   a repeat of one log must not count as a second failure. Each skip carries its block timestamp,
   stored as the row's `executedAt`. The scheduler holds `chargeLock` per subscription and sweeps
   every 15 minutes, so two real attempts on one subscription never share a block timestamp.
7. The projection's comment says the cron "runs every minute"; it runs every 15.

## Decision

1. **Keep the contract's model.** A balance or allowance retry reuses its attempt id. The fix is
   in the indexer only.
2. **A repeat payment-failure skip updates the existing row.** On a conflict, when the existing
   row is `failed` and the new skip's block timestamp is later than its `executedAt`, the
   projection sets `outcome`, `executedAt` and `attemptNumber = attemptNumber + 1`. It then treats
   the skip like a first failure:
   - inserts the `subscription.charge_failed` outbox event for that charge;
   - moves the subscription to `at_risk`, increments `retryCount` and sets `nextRetryAt` from the
     existing backoff (15m, 1h, 3h, 6h, 12h, then 24h).
3. **No-ops stay no-ops.**
   - A replay of the same log (same or earlier timestamp) changes nothing.
   - A non-payment skip (`NotDue`, `Duplicate`, `Ended`, …) never updates the row, so a late
     `Duplicate` can't overwrite a real outcome.
   - A row that already `succeeded` is never touched.
4. **Comments:** the worker's "burns an attempt id even when the charge fails" becomes "only a
   transfer that was attempted burns the id". The projection's "runs every minute" note is
   shortened and corrected.
5. **Docs:** the two "Not yet … #297" notes go (`subscriptions/recovery.mdx`,
   `subscriptions/lifecycle.mdx`). Recovery says each failed retry sends `charge_failed` with a
   rising `charge.attemptNumber`, and that about seven attempts fit in the grace window.

```
sweep ─► worker: attempt 0 unused ─► batchCharge ─► SubscriptionChargeSkipped(id0, InsufficientFunds)
                                                        │
indexer: INSERT charge(id0) ── new row ───────────────► charge_failed, retryCount 1, nextRetryAt +15m
         ON CONFLICT(id0) ── failed, later block ─────► attemptNumber+1, charge_failed, retryCount+1, next backoff
                           └ same log / non-failure / succeeded ─► nothing
```

## Trade-offs

- **Indexer fix, not a fresh id per retry.** Giving every retry a new id would also work, but the
  worker would have to read the indexer's rows to pick the index, and it goes against the
  contract's design and an existing test. Updating the row keeps one charge per attempt id and
  makes `attemptNumber` mean something.
- **Dedupe by block timestamp, not by log position.** A `(blockNumber, logIndex)` marker would be
  stricter but needs a migration. Timestamps are enough because one subscription's real attempts
  are at least one sweep apart (point 6).
- **Repeated events for one charge.** Each failed retry sends `charge_failed` with the same
  `charge.id`. The payload is built at delivery, so an event delivered late shows the latest
  `attemptNumber`. Merchants dedupe on the event id, as with any webhook.

## Tests (red first)

`apps/indexer/internal/store/store_e2e_test.go`, against Postgres:

1. Two `InsufficientFunds` skips under one attempt id, 15 minutes apart: `retryCount` 1 then 2,
   `nextRetryAt` = first block + 15m, then second block + 1h, `attemptNumber` 2, and two
   `subscription_charge_failed` outbox rows. Fails on `main` (count stays 1, backoff stuck).
2. The same skip projected twice (same timestamp): one outbox row, `retryCount` 1.
3. A `Duplicate` skip after an `InsufficientFunds` skip under the same id: outcome stays
   `insufficient_funds`, `retryCount` stays 1.
4. The existing same-id success upgrade still passes after two failures.
