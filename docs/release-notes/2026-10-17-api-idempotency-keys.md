---
date: 2026-10-17
feature: The API honours X-Strimz-Idempotency-Key, so a retried write runs once
scope: fix
scenario-impact: none
---

# API idempotency keys

Fixes #292. ADR: `docs/adr/ADR-2026-10-17-api-idempotency-keys.md` (and the for-dummies companion).

## What shipped

- **`IdempotencyInterceptor`**, global, after the rate limiter. It applies to `POST` and `PATCH` from an authenticated merchant that carry `X-Strimz-Idempotency-Key`.
  - Same key and request: the stored response is replayed with `X-Strimz-Idempotent-Replayed: true`. The handler doesn't run, so no second webhook.
  - Same key, different request: `409 idempotency_error`.
  - Repeat while the first is running: `409 idempotency_in_progress` with `Retry-After: 1`. The marker expires after 60s if the API dies mid-request.
  - Every response the handler produced is stored for 24h, errors included.
  - Keys are scoped to merchant and mode, and must be 1 to 255 visible ASCII characters.
  - Redis unreachable: `503 service_unavailable`, and the write does not run.
- **`@SkipIdempotency()`** on the four routes that return a one-time secret: API key create and rotate, webhook endpoint create and secret rotation. Their responses are never stored.
- **`@strimz/sdk`:** retries `409 idempotency_in_progress`; `StrimzIdempotencyError` covers it. Patch changeset.
- **Docs:** idempotency, API overview, errors (two new codes), glossary, server SDK and the SDK README. The #292 notes are gone.
- **Comments:** the Redis stub's stale "M2+ idempotency caches" note is shortened; the `RedisService` note on the dedup cache is now true.

## Operator steps

- Publish the patch changeset.
- Nothing to configure. The interceptor uses the API's existing Redis.

## Verification

- **Red, then green** on `ceeff7f`:
  - `apps/api/test/e2e/idempotency.e2e.test.ts`: 6 of 9 failed (the other 3 lock behaviour that must not change), now 9 of 9.
  - `packages/sdk/tests/fetcher.test.ts`: the in-progress retry failed; `errors.test.ts`: the new code failed.
- **Results:** sdk 69 of 69; `./scripts/preflight.sh` in full.
