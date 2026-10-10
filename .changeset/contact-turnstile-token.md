---
'@strimz/shared-types': minor
---

`contactRequestInputSchema` gains an optional `turnstileToken` (a non-empty string of at most 2048 characters), and `ContactRequestInput` / `ContactRequestParsed` gain the matching optional field. Existing callers still type-check and parse. The Strimz API now answers `POST /v1/contact` with `403 bot_check_failed` when the token is missing or Cloudflare Turnstile refuses it, so a caller that wants a delivered message must send one.
