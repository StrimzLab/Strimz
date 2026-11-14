---
date: 2026-11-13
feature: Webhooks are no longer lost when the scheduler restarts mid-dispatch
scope: fix
scenario-impact: none
---

# Webhook outbox claims in one transaction

A scheduler stopped by a deploy, crash or OOM kill between claiming outbox events and
preparing them left up to 100 events marked dispatched that were never sent, with no
error recorded. Now each event is claimed, hydrated and given its delivery rows in one
database transaction, so a stop at any point before the commit leaves the event for the
next tick. Delivery jobs are queued after the commit; if the process stops before that,
`webhook-recovery` re-queues the pending deliveries within about 2 minutes.

Up to 100 events per tick, one transaction each. Failures keep their meaning: a schema or
missing-row failure is quarantined with `dispatchError`, a transient one is retried on the
next tick.

ADR: `docs/adr/ADR-2026-11-13-webhook-outbox-claim-in-transaction.md`.

## After deploy (choice W3)

Follow `docs/runbooks/webhook-outbox-repair.md` once per environment, only after every
scheduler replica runs this fix: count the stranded events
(`webhook-outbox-stranded-count.sql`, read only), then release them
(`webhook-outbox-repair.sql`), optionally only those newer than an age limit. Record the
results here as stranded / released / age limit:

- sandbox: not run yet
- live: not run yet
