---
date: 2026-09-30
feature: A payment confirms a checkout session only when it matches it
scope: fix
scenario-impact: needs_automation
---

# Payments are verified against the session before it is confirmed

A hosted-checkout session is marked paid only by a payment that matches it: same
merchant, same amount, same token, same mode, and not already paid. Anything else is
recorded and flagged for the merchant, and the payment is never counted as that session.

Closes #109.

## What was wrong

The indexer confirmed whichever session a payment named in its reference. A payment of
1 unit with a real session id marked that session paid, marked its invoice paid, and
sent `payment.completed`. A second payment for a session that was already paid broke a
unique constraint, and the Payments indexer stalled on that event forever.

## What shipped

- Before confirming, the indexer compares the session's merchant, amount, currency and
  mode with the on-chain payment, and checks that the session has no transaction yet.
- A payment that does not match is still recorded as a transaction, without a session
  link. The session, its invoice and its webhooks are untouched. An `AuditLog` row with
  action `payment.session_mismatch` records the reasons and both sides of the
  comparison, scoped to the merchant who received the funds.
- The indexer cursor always advances. Replaying the same event stays a no-op.

## Not changed

- A payment whose reference matches no session is still recorded without a link, as
  before.
- Sessions in `expired` or `cancelled` are still confirmed by a matching payment.

## Follow-up

The audit row is written, but nothing shows it to the merchant yet. The dashboard and
alerting for these rows are not part of this change.
