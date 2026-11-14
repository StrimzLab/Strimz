# Release webhook events stranded by a scheduler restart

Before the 2026-11-13 fix (`docs/adr/ADR-2026-11-13-webhook-outbox-claim-in-transaction.md`),
a scheduler that stopped between claiming an outbox event and hydrating it left the event
marked dispatched with no deliveries. Its webhook was never sent.

Do this once per environment: sandbox first, then live.

## 1. Wait until no old scheduler is running

Run this only after the deploy has finished and every scheduler replica runs the fix.
An old-version scheduler can be holding an event in exactly the state the repair looks
for, and releasing it would send that webhook twice. The fixed dispatcher never leaves an
event in that state, so once only new replicas run, the repair is safe at any time.

## 2. Count (read only)

```bash
psql "$DATABASE_URL" -f docs/runbooks/webhook-outbox-stranded-count.sql
```

One row per event type and mode, with how many are stranded and the oldest and newest.

- **No rows:** nothing was lost. Stop here and record `0` in the release note.
- **A few, all recent:** go to step 3 and release them all.
- **Some are old:** merchants will receive them now, with their original event id and
  `createdAt`. A merchant who has since handled the payment by hand may act on it again
  unless their handler ignores event ids it has seen. Either release only recent ones
  (step 3 with an age limit) or tell the affected merchants first.

## 3. Release

All of them:

```bash
psql "$DATABASE_URL" -f docs/runbooks/webhook-outbox-repair.sql
```

Only events created in the last 7 days (any Postgres interval works):

```bash
psql "$DATABASE_URL" -c "SET strimz.repair_max_age = '7 days'" -f docs/runbooks/webhook-outbox-repair.sql
```

`psql` prints `UPDATE <n>`: record `n` and any age limit in the release note. The next
outbox tick, within a few seconds, dispatches those events. A hydrated event, one with no
subscribed endpoint and a quarantined one are never touched. Events older than the age
limit stay as they are; rerun without the limit later if you decide to send them.
