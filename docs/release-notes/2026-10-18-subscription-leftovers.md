---
date: 2026-10-18
feature: Remove leftover references to subscription operations that don't exist
scope: docs
scenario-impact: none
---

# Subscription leftovers

Closes #210. The docs examples the issue listed were removed in #154 (PR #298). This removes the two leftovers in code.

## What shipped

- `useCancelSubscription` no longer describes `at_period_end` and `immediate` cancel modes, and its success toast drops the "will end at period end" branch nobody could reach. The toast text merchants see is unchanged.
- The `AutoPagingIterator` example in `@strimz/sdk` uses `subscriptions.list` instead of `transactions.listAll()`, which doesn't exist.

Pause, resume, `chargeNow`, `cancel({ immediate })` and `listAll` stay unbuilt; each can get its own issue if merchants need it.

## Operator steps

None.
