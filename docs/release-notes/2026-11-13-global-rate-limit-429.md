---
date: 2026-11-13
feature: The global rate limit answers 429 instead of 500
scope: fix
scenario-impact: none
---

# Global rate limit answers 429

A client over the global limit (600 requests a minute per address) used to get
`500 api_error`, and the api logged an error for each one. It now gets
`429 rate_limited` with `Retry-After` and `details.retryAfterSec`, so `@strimz/sdk` waits
and retries instead of failing. The limit itself is unchanged.

`registerHttpPlugins` in `apps/api/src/common/http/http-plugins.ts` registers helmet and
the global limit for both `main.ts` and the e2e test factory, so the e2e suites now run
with both, as production does.

ADR: `docs/adr/ADR-2026-11-13-global-rate-limit-429.md`.

## Known gap, not changed here

The per-route limiter (`@RateLimit`) puts `retryAfterSec` at the top level of its error,
which `AllExceptionsFilter` drops. Its clients get `Retry-After` but no `retryAfterSec`.
