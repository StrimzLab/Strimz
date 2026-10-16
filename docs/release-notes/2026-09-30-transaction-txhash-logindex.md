---
date: 2026-09-30
feature: Every charge in a batch keeps its transaction row
scope: fix
scenario-impact: needs_automation
---

# Transactions are keyed by hash and log index

When the scheduler charges several subscriptions in one on-chain transaction, every
charge now gets its own transaction row. Before, only the first did.

Closes #110. ADR: [ADR-2026-09-30-transaction-key-txhash-logindex](../adr/ADR-2026-09-30-transaction-key-txhash-logindex.md)
([plain-English version](../adr/ADR-2026-09-30-transaction-key-txhash-logindex-for-dummies.md)).

## What was wrong

`Transaction.onchainTxHash` was unique on its own, and the indexer inserted rows with
"do nothing on conflict". A `batchCharge` transaction emits one `SubscriptionCharged`
event per subscription with the same hash, so every charge after the first lost its
transaction row. Its `subscription.charged` webhook then pointed at a row that did not
exist and failed to dispatch.

## What shipped

- Migration `20260930120000_transaction_txhash_logindex_key`: the unique key becomes
  `(onchainTxHash, logIndex)`, with a plain index kept on the hash.
- Both indexer inserts conflict on `(onchainTxHash, logIndex)`. Replays stay no-ops.
- Store tests: two charges in one transaction keep two rows and two webhook events; two
  session payments in one transaction confirm both sessions.

## Rows dropped before this change

They are not rebuilt by the migration. Because every projection is idempotent, they can
be rebuilt by resetting the Payments and Subscriptions cursors to the deployment block
and letting the indexer replay. That is an operational decision for the testnet
deployment.
