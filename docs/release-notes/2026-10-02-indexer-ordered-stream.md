---
date: 2026-10-02
feature: The indexer reads the Strimz contracts in chain order and parks what it cannot process
scope: fix
scenario-impact: needs_automation
---

# Indexer: one ordered stream and a dead-letter table

The indexer now reads all five Strimz contracts as one stream, in the order the chain
emitted their events. A payment can no longer be processed before the registration of
the merchant it pays, so it is no longer lost. Anything the indexer still cannot process
is kept in a table and retried, instead of being skipped or blocking a contract.

Closes #118. ADR: [ADR-2026-10-02-indexer-ordered-stream](../adr/ADR-2026-10-02-indexer-ordered-stream.md)
([plain-English version](../adr/ADR-2026-10-02-indexer-ordered-stream-for-dummies.md)).

## What was wrong

- Each contract had its own loop and cursor. A payment seen before its merchant's
  registration was skipped for good. A subscription for an unlinked merchant blocked its
  loop until the registry loop caught up.
- Charges, cancellations, agent job events and fee events for a missing row returned
  success without writing anything. Logs that failed to decode did the same.
- One batch could read logs from one RPC endpoint and block hashes from another.

## What shipped

- One loop and one cursor, `strimz-core`, for Registry, Payments, Subscriptions,
  AgentEscrow and FeeCollector. Logs are sorted by block and log index and projected in
  one transaction per batch. The stablecoin `Transfer` loops are unchanged.
- Each log is projected inside a savepoint. A log that cannot be projected is rolled
  back and written to the new `IndexerDeadLetter` table; the stream moves on. Database
  and RPC errors still fail the batch and keep the cursor where it was.
- After each pass the indexer retries up to 50 parked logs, oldest first. A log clears
  once its missing row exists.
- Every RPC call in a batch goes to one endpoint. An error fails the batch, and the next
  attempt uses the next endpoint.
- `/readyz` returns `{"status":"degraded","dead_letters":N}` with HTTP 200 while parked
  logs exist.
- Migration `20261002150000_indexer_dead_letter`.

## Deploy

1. Run `prisma migrate deploy`.
2. Start the new indexer. On its first run it creates the `strimz-core` cursor at the
   lowest of the five old contract cursors, and skips any log an old cursor had already
   processed until it has passed all of them. The old cursor rows stay untouched, so
   rolling back to the previous indexer resumes where it stopped.
3. The freshness monitor now watches `strimz-core` and the stablecoin cursors.

## Events lost before this change

Payments skipped by the old indexer are not recovered automatically. While the five old
contract cursor rows exist, the stream skips every log they cover, which includes those
skipped payments. To recover them:

1. Stop the indexer.
2. Delete the five old contract cursor rows from `IndexerCursor`. This gives up rolling
   back to the previous indexer.
3. Set the `strimz-core` cursor's `lastProcessedBlock` to the block before the first
   missing event and clear its `lastBlockHash`.
4. Start the indexer.

The projections are idempotent on transaction hash and log index, but indexer audit
rows are not, so a rewind writes those audit rows again.

## Watching parked logs

```sql
SELECT "contractAddress", "txHash", "logIndex", "blockNumber", reason, attempts, "createdAt"
  FROM "IndexerDeadLetter"
 WHERE "resolvedAt" IS NULL
 ORDER BY "blockNumber", "logIndex";
```
