# ADR: The API honours X-Strimz-Idempotency-Key

- **Status:** Accepted (approved by the maintainer, 2026-10-17)
- **Date:** 2026-10-17
- **Issue:** #292
- **Scope:**
  - `apps/api`: one global interceptor and its e2e tests.
  - `@strimz/sdk` (published, patch bump): retry one new `409` code.
  - Idempotency docs and the SDK README.
  - No database, contract, queue or webhook change.

## Context

Checked against `main` at `ceeff7f`.

1. **The SDK sends a key on every write.** `base-resource.ts:47,63` sets `X-Strimz-Idempotency-Key`
   on each `POST` and `PATCH`: the caller's value or a fresh `strimz_<uuid>`.
2. **Because a key is present, the SDK retries the write.** `fetcher.ts:120` retries a `5xx` up to
   `maxRetries` (3), and network failures are retried for any method (`fetcher.ts:127-134`).
3. **The API never reads the header.** It only appears in the CORS allow-list
   (`cors-policy.ts:19,30`). `RedisService` notes an "idempotency-key dedup cache" that doesn't exist.
4. **So a retry can create a second resource.** A `5xx` from the proxy after the API committed, or a
   dropped connection after the insert, makes the SDK send the write again. That covers payment
   sessions, plans, refunds, invoices, customers, webhook endpoints and API keys.
5. **What a duplicate costs.** No money moves twice: a payment session or refund still needs the
   payer's or merchant's signature, and the contracts reject reused nonces. But the merchant gets
   two sessions, two invoices or two plans, and two `*.created` webhooks.
6. Guards run before interceptors in Nest, so `req.merchant` (`merchantId`, `mode`) is already set
   when an interceptor runs. Validation pipes run after, inside the interceptor.
7. The e2e suite replaces Redis with an in-memory stub (`test/helpers/stubs/redis.stub.ts`) that
   supports `get`, `set … NX` and `del`, which is all the interceptor needs.

## Decision

1. **One global `IdempotencyInterceptor`**, registered after `RateLimitInterceptor` so a `429` is
   never stored.
2. **When it applies:** `POST` or `PATCH`, an authenticated merchant (`req.merchant`, by API key or
   dashboard JWT), and an `X-Strimz-Idempotency-Key` header. Anything else passes straight through:
   public checkout, relay (it has its own keys), admin, and requests without the header.
   - **Routes that return a one-time secret opt out** with a `@SkipIdempotency()` decorator:
     `POST /v1/api-keys`, `POST /v1/api-keys/:id/rotate`, `POST /v1/webhook-endpoints` and
     `POST /v1/webhook-endpoints/:id/rotate-secret`. Storing the response would keep a second
     plaintext copy of a secret key in Redis for 24h and hand it out again on replay. A duplicate
     there is a spare key the merchant can revoke.
3. **The key:** 1 to 255 visible ASCII characters, otherwise `400 invalid_request` with
   `param: "X-Strimz-Idempotency-Key"`. The SDK's own `strimz_<uuid>` format is not required, so
   `order-1234` works as the docs show.
4. **Scope:** Redis key `idem:{merchantId}:{mode}:{key}`. A key from one merchant, or from test mode,
   never collides with another.
5. **Fingerprint:** SHA-256 of method, route pattern, path and the JSON body. The same key with a
   different request returns `409 idempotency_error` ("This idempotency key was used with a
   different request").
6. **First request:** `SET NX` an `in_progress` record with a 60-second TTL, run the handler, then
   overwrite the record with `{ fingerprint, status, body }` for 24 hours.
   - **Stored:** every response the handler produced: 2xx, 4xx and 5xx, including validation errors.
     A key runs the handler at most once, as Stripe does. A merchant who wants a fresh attempt after
     a `500` sends a new key (the SDK does this on every new call).
   - **Not stored:** guard failures (`401`/`403`, they run before the interceptor) and `429`.
7. **Repeat request with the same fingerprint:**
   - **Done:** the stored status and body are returned as they were, with the header
     `X-Strimz-Idempotent-Replayed: true`. The handler does not run, so no second webhook.
   - **Still in progress:** `409` with code `idempotency_in_progress` and `Retry-After: 1`.
   - If the API dies mid-request, the `in_progress` record expires after 60 seconds and the key can
     run again.
8. **SDK:** the fetcher retries `409 idempotency_in_progress` like a `429`, honouring
   `Retry-After`. Other `409`s are unchanged.
9. **Redis down:** the request fails with `503`. It does not skip the check, because that would
   bring back the duplicates silently.
10. **Docs:** `concepts/idempotency.mdx`, `api/overview.mdx`, `errors.mdx` (the new code),
    `glossary.mdx`, `sdks/server.mdx` and the SDK README describe the real behaviour. The "Not
    yet … #292" notes go. The `RedisService` comment becomes true.

```
SDK POST + key ─► guards (merchant) ─► RateLimit ─► Idempotency ─┬─ no key / not merchant ─► handler
                                                                 ├─ SET NX ok ─► handler ─► store 24h ─► reply
                                                                 ├─ stored, same fingerprint ─► replay
                                                                 ├─ stored, other fingerprint ─► 409 idempotency_error
                                                                 └─ in_progress ─► 409 idempotency_in_progress (Retry-After 1)
```

## Trade-offs

- **Storing 5xx.** A transient failure under a key stays failed for 24h for that key. The upside is
  a hard rule: one key, one execution. The SDK makes a new key per call, so normal use doesn't hit
  this.
- **Redis, not Postgres.** Postgres in the same transaction as the write would also cover a crash
  between commit and storing the response. That touches every service. Redis covers the cases we
  see (proxy `5xx`, dropped connection, concurrent retry), and the 60s expiry handles a crash.
- **Body fingerprint uses the parsed JSON in the order received.** The SDK sends the same bytes on a
  retry, so this matches. A hand-written client that reorders keys gets `idempotency_error`, which
  is the safe direction.
- **Dashboard requests.** The web app doesn't send the header today, so it is unaffected.

## Tests (red first)

`apps/api/test/e2e/idempotency.e2e.test.ts`, against the real app with the Redis stub:

1. Same key and body twice on `POST /v1/payment-sessions`: one row, the same `id` twice, and the
   second response has `X-Strimz-Idempotent-Replayed: true`.
2. Same key, different body: `409 idempotency_error`, still one row.
3. Same key from another merchant: two separate rows. (A deployment accepts keys of one mode
   only, so mode separation is covered by the Redis key rather than a test.)
4. A stored `400` validation error is replayed.
5. A request while the first is `in_progress`: `409 idempotency_in_progress` with `Retry-After`.
6. A key over 255 characters: `400` naming the header.
7. No header: two requests, two rows (unchanged).
8. `POST /v1/api-keys` with a key: nothing stored in Redis, and a repeat issues a new key.

`packages/sdk`: the fetcher retries `409 idempotency_in_progress` and then returns the replayed
response; a plain `409 idempotency_error` is not retried.
