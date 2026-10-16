---
date: 2026-09-30
feature: Paid sessions can no longer be cancelled or expired, and invoice numbers no longer collide
scope: fix
scenario-impact: needs_automation
---

# Session state guard and serialised invoice numbers

A payment session that is already confirmed, cancelled or expired now refuses to be
cancelled or expired again. Two invoices created at the same moment now get distinct
numbers.

Refs #124 (parts 1 and 4). No schema, payload or published-package change, so no ADR.
The storefront stock reservation and the missing storefront `planId` from the same issue
are tracked in a separate ADR.

## What was wrong

- `POST /v1/payment-sessions/:id/cancel` and `/expire` updated the status from any
  state. A confirmed session could be marked cancelled after the payer had paid, and a
  cancelled session could be flipped to expired.
- Invoice numbers came from `count(*) + 1` per merchant. Two concurrent creates read
  the same count and produced the same number, which the unique index on
  `(merchantId, number)` turned into a 500.

## What shipped

- Cancel and expire only transition sessions in `created` or `awaiting_payment`. Any
  other status returns 403 with code `session_invalid_state`. The transition is a
  single conditional update, so two concurrent cancels cannot both succeed.
- Invoice creation runs in one transaction that locks the merchant row, reads the
  highest existing number and writes the session and invoice together. Concurrent
  creates for one merchant serialise on the lock.
- API tests: one per non-open status for cancel and expire, one happy-path each, and a
  concurrent invoice creation test that asserts three distinct sequential numbers.

## Scenario

No scenario file covers sessions or invoices yet. The e2e tests in
`apps/api/test/e2e/payment-sessions.e2e.test.ts` and `invoices.e2e.test.ts` are the
executable record until one exists.
