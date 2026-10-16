---
date: 2026-09-30
feature: Merchant cancellations and agent job funding reach the chain again
scope: fix
scenario-impact: needs_automation
---

# One shared definition for every background job

Cancelling a subscription in the dashboard now cancels it on chain, and approving an
agent job now funds its escrow. Before, the scheduler rejected every one of those jobs.

Closes #111. ADR: [ADR-2026-09-30-shared-queue-contracts](../adr/ADR-2026-09-30-shared-queue-contracts.md)
([plain-English version](../adr/ADR-2026-09-30-shared-queue-contracts-for-dummies.md)).

## What was wrong

The API enqueued `strimz.agent.action` jobs without the `type` field. The scheduler
parses those jobs with a discriminated union on `type`, so every job failed validation
in the worker. The API, scheduler and agent each kept their own copy of the queue names
and payload schemas, which is how the two sides drifted.

## What shipped

- New private package `@strimz/queue-contracts` with the queue names and the zod
  schemas for every BullMQ payload, plus fixtures for tests. The three apps import it
  and their own copies are deleted.
- The API enqueues agent actions and webhook deliveries through typed helpers on
  `QueueService` that parse the payload first. The agent's bridge worker parses its
  settle job before enqueueing it. A malformed job now fails where it is created.
- Contract tests in the package, API tests that parse the recorded payloads with the
  shared schema, and a scheduler test that consumes the shared fixture.

## Jobs that were already rejected

Jobs rejected before this change are not retried. The affected subscriptions are
cancelled off chain but still active on chain, and the affected agent jobs are accepted
but unfunded. Both are tracked under #122.
