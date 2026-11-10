---
date: 2026-11-10
feature: Indexer stream keeps advancing on Arc's RPC
scope: fix
scenario-impact: none
---

# Indexer stream topic filter

The indexer's core stream stopped advancing on Arc testnet, so payments, subscriptions
and merchant events never reached the dashboard (#410).

Each batch asked `eth_getLogs` for the Strimz contracts and all 52 subscribed event
topics. Arc's RPC and QuickNode reject a topic list longer than about ten entries with
`-32012 requested range too large`, whatever the block range, so the same batch failed
on every poll.

The stream now filters by contract address only and matches the subscribed topics in
the indexer. It is still one request per batch. Logs from events the indexer doesn't
project (proxy upgrades, role changes) are dropped before any block-time lookup, as
before.

No schema, payload or config change. The stablecoin scans already filtered by address
and a single topic, so they're unchanged.
