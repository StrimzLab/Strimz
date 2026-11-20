---
date: 2026-11-19
feature: Full-stack test for monthly subscription renewal, including a failed renewal that recovers
scope: chore
scenario-impact: none
---

# Monthly renewal, end to end

No tester could check a renewal, because it is a month away. The full-stack e2e now runs one. It covers the real contracts on a local Arc testnet fork, the API relay, the Go indexer, the scheduler and `@strimz/sdk`.

`e2e/full-stack/test/subscription-renewal.e2e.test.ts`:

1. **Signup with a capped allowance.**
   - A new payer signs up to a 3 USDC monthly plan.
   - They approve 12 charges, the same amount hosted checkout approves.
   - Their wallet holds exactly one month's price.
2. **Month 1.**
   - The scheduler charges the first month.
   - The indexer books the next charge 30 days out, matching the contract to the second.
3. **Month 2, empty wallet.**
   - The chain clock moves forward 30 days.
   - The renewal fails with `insufficient_funds`, and the subscription goes `at_risk`.
   - No money moves, the contract's period doesn't advance, and `subscription.charge_failed` reaches the merchant's endpoint.
4. **Month 2, after a top-up.**
   - The payer tops up, and the next retry charges.
   - The subscription returns to `active` and the retry state clears.
   - The period moves to month two, and the next charge is booked 30 days later.
   - The merchant's payout rises by the net amount.
   - `strimz.subscriptions.retrieve` and `.charges` show the same thing.

How the clock works:

- The scheduler picks due subscriptions by server time, while the contract uses block time.
- The test runs the fork's clock 31 days behind real time, so one 30-day warp makes the renewal due for both, without faking any service's clock.
- It puts the fork's clock back when it finishes.

Other changes:

- `signEnrolment` accepts a permit value, so a test can sign a capped allowance.
- The seeded merchant's endpoint also subscribes to `subscription.charge_failed`.

## Found while writing it

- **#497:** the indexer files a new subscription under the first active plan with the same price, currency and interval. A merchant with two such plans can get the wrong `planId` in webhooks. The renewal test uses its own price so the suites don't collide, and the fix is tracked there.
