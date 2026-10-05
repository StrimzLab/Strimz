# ADR for Dummies: Remove the SDK buttons that were never wired up, and check all the others

- **Status:** Accepted 2026-10-04
- **Date:** 2026-10-04

## The Idea

The Strimz code library for developers (the SDK) has a "create subscription" call that
asks the Strimz server for an address that does not exist, so it fails every time. Two
more calls, "update merchant" and "change tier", go to addresses that only the
dashboard may use, so they also fail every time. We remove all three and add an
automatic check that compares every SDK call with the server's list of addresses, so
this cannot quietly happen again.

## What the Person Sees

1. A merchant's developer creates a subscription plan with the SDK and gets back the
   plan's link, as today.
2. They send that link to a customer. The customer opens it, connects a wallet and
   signs. That signature is what creates the subscription, on the blockchain, as
   today.
3. Strimz notices the new subscription and tells the merchant's server through a
   webhook. The developer reads it with `subscriptions.list` or `retrieve`, as today.
4. What changes: the developer no longer sees a `subscriptions.create` call in their
   editor that looks like it should work and then fails. Same for the two merchant
   calls; those settings live in the dashboard.

## Important Limitation

- A merchant still cannot make a subscription from their own server. Only the customer
  can, because only the customer can sign for their wallet. That is not new; the SDK
  call just pretended otherwise.
- There is still no way to make a link for one specific customer (with their email
  filled in, for example). That would be a new feature with its own decision.
- The new check confirms each SDK call reaches a real address that accepts the
  developer's key. It does not check the contents of each request.
- Several documentation pages describe other calls that do not exist (pause, resume,
  charge now, cancel immediately, list all). Those get their own issue.

## What Changes

- `@strimz/sdk` 0.8.0 drops `subscriptions.create`, `merchants.update` and
  `merchants.changeTier`.
- `@strimz/shared-types` 0.9.0 drops the description of the "create subscription"
  request.
- A new automated test in the Strimz server's test suite fails if any SDK call points
  at a missing address or at one the developer's key may not use.
- The documentation stops showing the removed calls and stops claiming the grace period
  can be set when a subscription is created.

## What Does Not Change

- How customers subscribe: the plan link, the wallet signature and the blockchain
  transaction.
- The server's addresses, the database, webhooks, the contracts and the dashboard.
- Any integration that works today. The three removed calls have never worked with a
  developer's key.
