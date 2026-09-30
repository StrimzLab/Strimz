# ADR for Dummies: Key `Transaction` rows by transaction hash and log index

- **Status:** Accepted 2026-09-30
- **Date:** 2026-09-30

## The Idea

When Strimz charges several subscriptions in one blockchain transaction, the database
keeps a record of only the first one. We change how a payment record is identified so
every charge in the batch is kept.

## What the Person Sees

1. A merchant has three subscribers due on the same day.
2. The scheduler charges all three in one transaction to save gas.
3. Today the dashboard shows one payment. After this change it shows three, one per
   subscriber.
4. Webhooks for the second and third charges stop failing, because the payment they
   point at now exists.

## Important Limitation

Payments dropped before this change are not recreated automatically. They can be
recovered by replaying the chain history into the database, which is a separate
decision for the testnet deployment.

## What Changes

- One database migration: a payment record is identified by transaction hash plus its
  position in the transaction, instead of the hash alone.
- The indexer writes one record per charge.

## What Does Not Change

- Refunds, invoices, sessions, the API, the SDK, the dashboard, the contracts.
- Replaying old events still creates no duplicates.
