---
date: 2026-09-30
feature: A retried charge that succeeds is recorded as succeeded
scope: fix
scenario-impact: needs_automation
---

# Retried charges record their success

When a subscription charge fails for lack of funds or approval and the retry succeeds,
the charge now shows as succeeded. Before, it stayed marked failed forever, the
`subscription.charged` webhook carried a failed charge, and the merchant's payment email
never went out.

Closes #112.

## What was wrong

The contract leaves the attempt id unspent when a charge fails before any money moves,
so the scheduler retries under the same id. The indexer inserted the successful charge
with "do nothing on conflict", which kept the failed row from the first attempt.

## What shipped

On a successful charge whose attempt id already has a failed row, the indexer upgrades
that row: status `succeeded`, outcome `charged`, and the transaction hash, amount and
execution time of the successful attempt. The transaction, period advance, status reset
and webhook then follow as for any first-time success. A replay of a success that was
already recorded stays a no-op.
