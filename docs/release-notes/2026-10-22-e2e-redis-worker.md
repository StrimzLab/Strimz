---
date: 2026-10-22
feature: API e2e no longer dials a real Redis; relay worker errors are logged
scope: fix
scenario-impact: none
---

# API e2e no longer dials a real Redis; relay worker errors are logged

Closes #351.

## What shipped

- **Test app:** the API e2e test app replaces `RelayProcessor` with a no-op.
  - It used to hand the stubbed Redis client to a BullMQ `Worker`. BullMQ doesn't accept that stub, so it opened its own connection to `127.0.0.1:6379` and retried for the whole run.
  - On CI that logged about 112 connection errors per run. Twice, two of them surfaced as unhandled rejections and failed the job (PR #350).
- **Guard:** `test/e2e/no-real-redis.e2e.test.ts` fails if the test app opens any socket to port 6379.
- **API:** the relay worker now has an `error` listener that logs, so a lost Redis connection in production shows up in the logs.

## Not changed

- Relay behaviour, queue payloads, and the scheduler, agent and indexer suites (none of them showed the error).
