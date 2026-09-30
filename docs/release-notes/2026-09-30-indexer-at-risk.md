---
date: 2026-09-30
feature: Failed subscription charges set at_risk in every billing cycle
scope: fix
scenario-impact: needs_automation
---

# Failed charges set at_risk again after the second paid cycle

A subscriber whose payment fails is now marked `at_risk` no matter how many cycles they
paid before. Merchants see the failed payer on the dashboard, the retry backoff starts,
and the grace-period lapse applies.

Closes #113.

## What was wrong

When a charge failed, the indexer skipped the `at_risk` update if the subscription's
current period already had a successful charge. From the second paid cycle on, the
current period is always the last paid one, so that was always true. A payer who
stopped paying after two cycles stayed `active` forever:

- `retryCount` and `nextRetryAt` were never set, so the sweeper retried the charge on
  chain every 15 minutes with no backoff.
- The subscription never reached `lapsed`.
- The `subscription.charge_failed` webhook was still sent.

## What shipped

- The period check is removed. A skip with a payment-failure outcome always sets
  `at_risk`, increments `retryCount`, and schedules `nextRetryAt`.
- The update runs only when the charge attempt is new. Replaying the same event no
  longer increments `retryCount` a second time.
- Skips that are not payment failures, such as `not_due` and `duplicate`, still change
  nothing. That gate already existed.

## Tests

- New store test: two paid cycles, a failure, a replay of that failure, a second
  failure, then a successful charge.
- The `not_due` test now checks that the skip adds no webhook event. It used to expect
  zero events of any kind, which the `subscription.created` event always broke.
- The indexer store suite runs on macOS again. `test:e2e` and `make test-e2e` build
  without cgo, because a transitive dependency crashes in native code at startup.

## Behaviour change to expect

Subscriptions that are failing today but still marked `active` will move to `at_risk`
on their next failed attempt after deploy, and to `lapsed` when the grace period ends.
Rows are not backfilled.
