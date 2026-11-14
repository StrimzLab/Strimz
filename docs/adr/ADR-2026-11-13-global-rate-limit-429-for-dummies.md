# ADR for Dummies: "Slow down" should say "slow down", not "we're broken"

- **Status:** Approved by the maintainer on 2026-11-13, with the recommended choices
- **Date:** 2026-11-13

## The Idea

Strimz limits how many requests one address can send each minute: 600. That's fine. The
problem is how it says no. Instead of "too many requests, try again in 30 seconds", it
answers "internal server error", the same thing it says when Strimz itself is broken.

So a busy merchant thinks Strimz is down. Our own SDK, which knows how to wait and retry
when told to slow down, gives up instead. And our error logs fill up with false alarms.

The fix: when the limit is hit, Strimz answers "too many requests", says how many seconds
to wait, and doesn't log it as an error. The limit itself stays the same.

## What the Person Sees

- **Merchants:** a clear "slow down, retry in N seconds" instead of a scary error. Their
  SDK waits and retries on its own.
- **The maintainer:** no more fake errors in the logs when a merchant is simply busy.

## Important Limitation

- The limit of 600 requests a minute per address doesn't change. A merchant sending more
  than that from one server still has to slow down. Whether 600 is right is a separate
  decision.

## What Changes

- How the API answers when the overall limit is hit.
- The API's tests now run with the same limits as production.

## What Does Not Change

- The limits, the contracts, the database, the SDK and every other answer the API gives.

## Choices for the maintainer

- **L1.** Answer "too many requests" with the wait time, in the same format as our other
  limits. Recommended.
- **L2.** Register the limits in one place used by both production and the tests.
  Recommended.
- **L3.** Keep 600 a minute for now and decide on the number separately. Recommended.
