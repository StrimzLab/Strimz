---
date: 2026-10-03
feature: A subscription that falls behind is charged once, on its original billing day, and the missed periods are dropped
scope: fix
scenario-impact: needs_automation
---

# Subscriptions: one charge after a gap, missed periods dropped

A subscription that falls several periods behind is now charged once when it recovers,
not once per missed period. The charge pays the current period on the original billing
day, the next charge is always in the future, and the dropped periods are recorded.

This is a contract change. It takes effect only when the new `StrimzSubscriptions` is
deployed, which happens in #142. Subscriptions on the deployed contract keep the old
behaviour until #142 moves them.

Closes #114. ADR: [ADR-2026-10-03-subscriptions-drop-missed-periods](../adr/ADR-2026-10-03-subscriptions-drop-missed-periods.md)
([plain-English version](../adr/ADR-2026-10-03-subscriptions-drop-missed-periods-for-dummies.md)).

## What was wrong

- A successful charge moved `nextChargeAt` forward by one interval. A subscription N
  periods behind stayed due, so the next N sweeps each charged it again.
- This happens after a scheduler outage longer than one interval, or when a payer who
  failed a charge pays on a later retry.

## What shipped

- `StrimzSubscriptions._charge` works out the period being paid. If the charge is a full
  interval or more late, the whole missed periods are skipped and the charge pays the
  period that contains the current time. After a successful charge `nextChargeAt` is the
  next anchor on the original schedule, strictly in the future. A failed charge changes
  nothing.
- New event `SubscriptionPeriodsSkipped(uint256 indexed subscriptionId, uint256
periodsSkipped, uint64 paidPeriodStart)`, emitted only when periods are skipped and the
  charge succeeds, immediately before `SubscriptionCharged`. Existing event signatures
  are unchanged.
- The indexer projects the new event: it sets `Subscription.nextChargeAt` to
  `paidPeriodStart` and writes an `AuditLog` row `subscription.periods_skipped` for the
  merchant with `periodsSkipped`, `paidPeriodStart` and `txHash`. The charge row that
  follows records the period actually paid. An unknown subscription is parked like other
  subscription events.
- The indexer's subscriptions ABI is regenerated. The scheduler's ABI holds only the
  functions it calls, so it is unchanged.
- The merchant docs page on charging warns that, until the new contract is deployed, a
  subscription more than one period behind is charged once per missed period.

## Deploy

Nothing to deploy with this change. The indexer can ship first: it decodes the old
contract as before and the new event only appears once #142 deploys the new contract.
#142 also removes the docs warning and owns the plan for subscriptions on the old
contract.
