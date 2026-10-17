---
date: 2026-10-17
feature: Every failed charge retry advances the backoff and fires subscription.charge_failed
scope: fix
scenario-impact: none
---

# Charge retry backoff

Fixes #297. ADR: `docs/adr/ADR-2026-10-17-charge-retry-backoff.md` (and the for-dummies companion).

## What shipped

- **Indexer:** a payment-failure `SubscriptionChargeSkipped` under an attempt id that already has a failed row now counts when its block is later than the row's `executedAt`. It updates `outcome`, `executedAt` and `attemptNumber`, fires `subscription.charge_failed`, and advances `retryCount` / `nextRetryAt` (15m, 1h, 3h, 6h, 12h, then 24h).
  - Before, the insert hit `ON CONFLICT ("chargeAttemptId") DO NOTHING` and returned, so after the first failure the sweeper retried every 15 minutes until the subscription lapsed (about 192 transactions over 48h) and the merchant heard once.
  - A replayed log, a non-payment skip (`not_due`, `duplicate`, …) and a charge that already succeeded change nothing.
- **Scheduler:** the subscription-due worker's comment no longer claims every failure burns the attempt id.
- **Docs:** the #297 notes are gone from the recovery and lifecycle pages. `charge_failed` is described as sent per failed retry, with `charge.attemptNumber`.

## Behaviour change for merchants

`subscription.charge_failed` now arrives for each failed retry in a period, all referencing the same `charge.id` with a rising `attemptNumber`. Dedupe on the event id.

## Operator steps

None. No migration; deploy the indexer.
