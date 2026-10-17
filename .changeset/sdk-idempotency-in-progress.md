---
'@strimz/sdk': patch
---

The API now honours `X-Strimz-Idempotency-Key`, so a retried write replays the first response instead of creating a second resource. The client retries `409 idempotency_in_progress` (a repeat that arrives while the first request is still running), honouring `Retry-After`, and `StrimzIdempotencyError` covers that code once retries run out.
