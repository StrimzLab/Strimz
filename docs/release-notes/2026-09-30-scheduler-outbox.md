---
date: 2026-09-30
feature: Webhook outbox retries transient failures; crons write events atomically; recovery stops duplicating deliveries
scope: fix
scenario-impact: needs_automation
---

# Webhook outbox and recovery hardening

Merchants stop losing webhooks to transient database errors and stop receiving the
same delivery twice.

Closes #120.

## What was wrong

- The outbox dispatcher stamped an event as dispatched before processing it. Any
  failure, transient or not, left the event stamped and quarantined for ever.
- The lapsed, overdue and session-expiry crons flipped rows in one statement and wrote
  the matching outbox events afterwards. A crash in between lost the events.
- The recovery cron re-queued every pending delivery whose next attempt was unset,
  including ones created a second ago whose job was already queued, so the same
  delivery was posted twice at once. It also re-queued deliveries for disabled
  endpoints.

## What shipped

- The dispatcher classifies failures. A validation error, or a reference to a row that
  does not exist, quarantines the event with `dispatchError` as before. Any other
  failure records the error and releases the event, so the next tick retries it. The
  last error stays visible on the row until a dispatch succeeds, then it is cleared.
- The three crons flip rows and write their outbox events in one transaction. If the
  event cannot be written, the flip rolls back and the next run retries.
- The recovery cron only re-queues a delivery with no scheduled attempt once it is at
  least two minutes old, and only for active endpoints.

## Not changed

An event that fails for a transient reason on every tick is retried every tick, with no
backoff. Adding backoff needs an attempt counter on `WebhookEvent`, a schema change
that is not part of this fix.
