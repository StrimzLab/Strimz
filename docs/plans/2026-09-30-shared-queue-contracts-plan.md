# Plan: shared queue contracts (2026-09-30)

ADR: docs/adr/ADR-2026-09-30-shared-queue-contracts.md. Issue: #111.

## Boundaries

- New: `packages/queue-contracts` with queue names, zod schemas, inferred types, and
  test fixtures. Depends on `zod` only.
- Changed: `apps/api` (queue service and the three producers), `apps/scheduler` and
  `apps/agent` (imports, one producer each). Their local copies are deleted.
- Untouched: database, contracts, webhook payloads, public API, published packages.

## Interfaces

- `QueueService.addAgentAction(job)` and `QueueService.addWebhookDelivery(job)` in the
  API parse with the shared schema, then enqueue with the job name equal to `type`.
- Every other producer parses with the shared schema before `queue.add`.
- `@strimz/queue-contracts/fixtures` exports one valid payload per job arm for tests.

## State changes

None. Jobs already in Redis without a `type` stay invalid.

## Test strategy

- Package: every fixture parses; every arm rejects a missing `type` and missing
  fields.
- API e2e: the recorded payload for cancel and for agent job creation parses with the
  shared schema. These fail on `main`.
- Scheduler e2e: the agent-action worker consumes the shared cancel fixture.

## Steps

1. Create the package from the scheduler's and agent's existing definitions, with the
   settle arm defined once.
2. Point the scheduler and agent at the package and delete their copies.
3. Add the typed helpers to the API queue service and use them in the three producers.
4. Make the tests parse recorded payloads.
