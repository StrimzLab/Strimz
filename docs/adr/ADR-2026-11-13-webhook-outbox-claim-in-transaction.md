# ADR: Claim, hydrate and fan out each outbox event in one database transaction

- **Status:** Approved by the maintainer on 2026-11-13, with the recommended choices
- **Date:** 2026-11-13
- **Scope:** `apps/scheduler` (`WebhookOutboxService`) and a one-time repair query. No contract, Prisma migration, job payload, webhook payload or published package changes. The api, indexer and agent are unchanged.

## Context

Producers write `WebhookEvent` rows with `dispatchedAt` NULL. Every 4 s the dispatcher
(`webhook-outbox.service.ts`) runs, as separate statements:

1. `UPDATE "WebhookEvent" SET "dispatchedAt" = NOW() WHERE id IN (SELECT … WHERE "dispatchedAt" IS NULL … LIMIT 100 FOR UPDATE SKIP LOCKED)`, which commits at once;
2. for each claimed event: hydrate the `{ ref }` payload, write the envelope, create
   `WebhookDelivery` rows and enqueue their jobs.

Nothing ever selects an event whose `dispatchedAt` is set again. A scheduler that stops
between 1 and 2 (a deploy's SIGTERM, an OOM kill, a crash) leaves up to 100 events
claimed, unhydrated and with no deliveries. They are never sent, and no error is recorded.

Proof, both failing on `main` at `b23a88d`:

- `apps/scheduler/test/e2e/webhook-outbox.e2e.test.ts` › "commits no claim while the event
  is still being hydrated, so a crash there loses nothing": with hydration held open, the
  event already reads `dispatchedAt` set from another connection. A kill at that moment
  strands it. (This replaced a first red test that seeded an already-stranded event: no
  tick should pick that up under this decision, so it could never go green. Stranded
  events are the repair query's job, tested separately.)
- `e2e/full-stack/chaos/outbox-crash.chaos.test.ts` (branch `test/e2e-full-stack`): a real
  `payment.completed` is claimed, the scheduler is SIGKILLed, restarted, and after 60 s
  the event is still claimed, unhydrated, with 0 deliveries and no `dispatchError`.

A time-based reclaim of old claims cannot tell an abandoned claim from a finished event
that no endpoint subscribes to: both have `dispatchedAt` set and no deliveries.

`WebhookRecoveryService` already re-queues `pending` deliveries older than 2 minutes that
are not in BullMQ.

## Decision

1. **One transaction per event.** Each tick opens a transaction per event that:
   - selects one undispatched event `FOR UPDATE SKIP LOCKED`, oldest first;
   - hydrates it;
   - writes the envelope and `dispatchedAt = NOW()`;
   - inserts its `WebhookDelivery` rows;
   - commits.

   A process that dies at any point before the commit leaves the event untouched, with
   `dispatchedAt` NULL, and the next tick takes it. `SKIP LOCKED` keeps replicas from
   taking the same row, as today.

2. **Enqueue after commit.** Delivery jobs are added to BullMQ only after the commit. If the
   process dies between commit and enqueue, the deliveries sit `pending`, and
   `WebhookRecoveryService` re-queues them within its 2-minute window. A job added for a
   rolled-back transaction can't happen, because nothing is added before the commit.
3. **Up to 100 events per tick**, one transaction each, so one slow hydration holds one row
   lock, not a hundred.
4. **Failures keep their current meaning.** A permanent failure (schema validation) stamps
   `dispatchError` and `dispatchedAt` in its own transaction, so the event stays quarantined.
   A transient failure rolls back and leaves the event for the next tick.
5. **Repair the events already stranded.** A runbook step for the maintainer,
   `docs/runbooks/webhook-outbox-repair.md`, run once per environment and only after every
   scheduler replica runs the fix (an old replica can hold an event in the state the
   repair matches, and releasing it would send that webhook twice):
   - `webhook-outbox-stranded-count.sql` counts the stranded events by type and mode, with
     the oldest and newest, read only;
   - `webhook-outbox-repair.sql` sets `dispatchedAt = NULL` on unhydrated `{ ref }` events
     with no deliveries and no `dispatchError`. A hydrated event no longer has a `ref` key,
     so it never matches. Setting `strimz.repair_max_age` (for example `'7 days'`) first
     releases only events that recent, for when old events would surprise merchants.

   The release note records the counts and any age limit.

## Diagram

```mermaid
sequenceDiagram
    participant D as Dispatcher (one tick)
    participant PG as Postgres
    participant Q as BullMQ
    loop up to 100 events
        D->>PG: BEGIN
        D->>PG: SELECT event WHERE dispatchedAt IS NULL FOR UPDATE SKIP LOCKED LIMIT 1
        D->>PG: hydrate (read session, transaction, …)
        D->>PG: UPDATE payload, dispatchedAt; INSERT deliveries
        D->>PG: COMMIT
        Note over D,PG: a crash before COMMIT rolls everything back
        D->>Q: add delivery jobs
        Note over D,Q: a crash here leaves pending deliveries, re-queued by webhook-recovery
    end
```

## Consequences

- No event can be lost to a restart. The worst case is a delivery up to 2 minutes late.
- A transaction per event costs a few more round trips per tick. At 100 events every 4 s
  that is well inside Postgres's capacity.
- Row locks are held while hydrating, which reads a handful of rows. Producers insert new
  events and never update old ones, so they don't wait on these locks.
- The claim and the work now commit together, so the time an event shows `dispatchedAt`
  without its envelope drops to zero.

## Alternatives considered

- **Reclaim claims older than N minutes.** Can't separate an abandoned claim from a
  finished event with no subscribers, so it would need a new `claimedAt` column and a
  migration, and it still re-sends late.
- **One transaction for the whole batch of 100.** One failing hydration would roll back the
  other 99, and the lock would be held for the whole batch.
- **Enqueue inside the transaction.** A crash after enqueue and before commit sends a
  webhook for an event the database then forgets; with BullMQ outside Postgres there is no
  shared commit.

## Verification

- **Red, already written:** the two tests named in Context.
- **Green:**
  - both pass;
  - the 10 existing dispatcher tests in `webhook-outbox.e2e.test.ts` pass, including
    "does not dispatch the same event twice", and so does the new guard "leaves a fresh
    claim to the scheduler that holds it";
  - new: a hydration that throws after the claim leaves `dispatchedAt` NULL and no
    deliveries;
  - new: two dispatchers ticking at once on 50 events create exactly one delivery per
    event and endpoint. Under read committed, `LIMIT 1 FOR UPDATE SKIP LOCKED` can come back
    empty when the row it picked was committed by the other dispatcher meanwhile, so an
    empty read is retried once; anything still left is taken by the next tick;
  - the repair query (`docs/runbooks/webhook-outbox-repair.sql`), run on a fixture with one stranded `{ ref }` event, one hydrated
    event without subscribers and one quarantined event, resets only the first.
- The full-stack, stress and chaos suites pass; `./scripts/preflight.sh` passes in full.
