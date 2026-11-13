# ADR for Dummies: Show every attempt to charge a subscriber

- **Status:** Accepted 2026-11-13
- **Date:** 2026-11-13

## The Idea

Each billing period, Strimz tries to charge every subscriber. Today the dashboard only shows the attempts that worked. When a charge fails, or is skipped because Strimz stopped accepting that coin, the merchant sees nothing. This adds a list of every attempt to the subscription page, with a plain reason for each one.

## What the Person Sees

1. A merchant opens a subscription.
2. A new "Charge attempts" card lists each try: the billing period, when it ran, and the result.
3. Successful charges read "Charged". Failed ones say why, for example "Failed: not enough balance".
4. If Strimz stopped accepting the subscriber's coin, the row reads "Skipped: token not accepted" in grey, not red, because it isn't the customer's fault and the subscription stays active.
5. A link opens the transaction on the block explorer when there is one.

## Important Limitation

Developers using the Strimz SDK won't have a ready-made method for this list yet. They can call the API route directly. Adding it to the SDK is a follow-up.

## What Changes

- New "Charge attempts" card on each subscription page, in light and dark.
- A new read-only API route that returns those attempts.

## What Does Not Change

- How or when subscribers are charged.
- The existing list of payments received.
- Webhooks, the database, and the contracts.
