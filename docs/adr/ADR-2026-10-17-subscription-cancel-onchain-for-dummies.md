# ADR for Dummies: Cancelling from the API also cancels on the blockchain

- **Status:** Accepted (approved by the maintainer, 2026-10-17)
- **Date:** 2026-10-17

## The Idea

A subscription lives in two places: our database and the smart contract on the blockchain. When a
merchant cancels through our API, we mark it cancelled in the database and ask our scheduler to
cancel it on the blockchain too.

The contract only lets the subscriber or the merchant cancel. Our scheduler is neither, so the
blockchain cancel has always failed. Strimz stops charging, but the blockchain still says the
subscription is live.

## What Changes

1. The contract also lets Strimz's scheduler cancel. That's the same account already allowed to
   charge subscriptions.
2. If the subscriber or merchant already cancelled on the blockchain themselves, the scheduler
   notices and doesn't try again.
3. The docs drop the "not yet" warning and explain when the fix goes live.

## Important Limitation

- The contract can't be updated in place. The fix goes live when we redeploy the subscriptions
  contract, which is already planned before mainnet. Until then, the blockchain cancel on the
  current test network keeps failing (charging still stops).
- The scheduler's key can now cancel subscriptions. It could already charge them, and we can take
  that permission away at any time.

## What Does Not Change

How merchants call cancel, the webhooks they receive, the database and the payment flow stay the
same.
