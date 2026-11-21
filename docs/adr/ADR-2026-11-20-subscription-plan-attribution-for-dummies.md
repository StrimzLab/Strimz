# ADR for Dummies: Remember which plan a customer signed up for

- **Status:** Accepted 2026-11-20 by the founder
- **Date:** 2026-11-20

## The Idea

When someone subscribes, the blockchain records the price and how often to charge, but not which of the merchant's plans they picked. Strimz guesses the plan from the price. If a merchant has two plans at the same price, for example "Design" and "Writing" at 10 USDC a month, the guess can be wrong. The merchant is then told the customer bought the other plan, and may give them the wrong product.

The fix: when Strimz submits the signup, it writes down "this signup is for plan B". The signup already carries a unique code tied to plan B. The new contract (see the contract ADR) puts that code on the blockchain record, so Strimz matches the code and never has to guess.

## What the Person Sees

- **Merchants:** the plan in their dashboard and webhooks is always the one the customer chose.
- **Customers:** nothing changes.

## Important Limitation

- **It needs the new subscription contract,** which is already being deployed for the audit fixes.
- **Signups made outside Strimz checkout** (calling the contract directly) carry no code. For those, if two plans match, Strimz picks the oldest and flags the subscription so the merchant can check it.

## What Changes

- A new table in the database, the API's signup step, and the indexer.

## What Does Not Change

- Prices, charging, renewals and webhook shapes.
