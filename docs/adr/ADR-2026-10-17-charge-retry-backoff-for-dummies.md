# ADR for Dummies: Failed charges slow down instead of retrying every 15 minutes

- **Status:** Accepted (approved by the maintainer, 2026-10-17)
- **Date:** 2026-10-17

## The Idea

When a subscriber's wallet is short on funds, Strimz retries the charge later. Retries are meant
to slow down: 15 minutes, then 1 hour, 3 hours, and so on, so we don't spend gas trying to charge
an empty wallet over and over.

That slowdown only worked the first time. Every retry after it looked to our records like the
same attempt, so we ignored it. The result: Strimz retried every 15 minutes for two days (about
192 transactions, gas on us), and the merchant heard about the failure only once.

## What Changes

1. Each failed retry now counts. The wait between retries grows as designed.
2. The merchant gets a "charge failed" notice for each failed retry, and the notice says which
   attempt it was.
3. The docs drop the "not yet" warning.

## Important Limitation

- The same failure being read twice by our system (for example after a restart) still counts
  once.
- A merchant now gets several "charge failed" notices for one billing period instead of one. Each
  has its own event id, and the first one is still the one to act on.

## What Does Not Change

The smart contract, the database structure and the webhook format stay the same. Successful
charges work as before.
