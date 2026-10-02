# ADR for Dummies: Read the blockchain in the order things happened, and never drop an event quietly

- **Status:** Accepted 2026-10-02
- **Date:** 2026-10-02

## The Idea

The indexer is the part of Strimz that watches the blockchain and updates the
dashboard. Today it watches each Strimz contract separately, so it can see a payment
before it has seen the merchant that payment belongs to. When that happens the payment
is thrown away. We make it read all Strimz contracts together, in the exact order the
blockchain recorded them, and keep anything it cannot process in a holding table
instead of throwing it away.

## What the Person Sees

1. A new merchant is registered on the blockchain, and a minute later a customer pays
   them.
2. Today, if the indexer happens to look at payments before registrations, that payment
   never shows up in the merchant's dashboard.
3. After this change, the indexer always processes the registration first, so the
   payment appears.
4. If something truly cannot be processed, for example a payment to a merchant Strimz
   does not know, it goes into a holding table. Strimz tries it again regularly, and the
   health check tells the operator how many are waiting.

## Important Limitation

Events already thrown away before this change are not recovered automatically. They can
be recovered by rewinding the indexer, which is a separate operational step.

## What Changes

- The indexer reads all Strimz contracts as one stream, in blockchain order.
- Nothing is silently dropped. Anything it cannot process is kept and retried.
- Each batch reads from a single blockchain data provider, so data from two providers
  is never mixed.
- The health check reports when events are waiting in the holding table.
- One new database table for the holding area.

## What Does Not Change

- The smart contracts, the API, the dashboard, webhooks and the SDK.
- Where the indexer picks up from: it continues from where it stopped, without
  processing anything twice.
