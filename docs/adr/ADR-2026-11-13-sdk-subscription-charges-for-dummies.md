# ADR for Dummies: Charge attempts in the Strimz SDK

- **Status:** Accepted 2026-11-13
- **Date:** 2026-11-13

## The Idea

The dashboard now shows every attempt to charge a subscriber, including failed and skipped ones. Developers who use the Strimz SDK in their own code can't get that list yet without writing the request themselves. This adds one ready-made method for it.

## What the Person Sees

1. A developer writes `strimz.subscriptions.charges('sub_123')`.
2. They get back the same list the dashboard shows: each attempt, its result and when it ran.
3. The API docs explain the method, with an example.

## Important Limitation

It returns one page at a time, like the other list methods. Developers ask for the next page themselves.

## What Changes

- A new method in the SDK, released as a minor version.
- The API docs page for subscriptions.

## What Does Not Change

- The API itself, the dashboard, and anything about charging.
