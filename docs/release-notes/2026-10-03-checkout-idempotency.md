---
date: 2026-10-03
feature: The relay issues submission keys from the signed payload, and checkout retries are safe
scope: fix
scenario-impact: needs_automation
---

# Checkout: server-issued relay keys, one payment nonce per session, safe retries

A stranger can no longer block a checkout by posting junk under the session id, and
"Try again" on the checkout page now submits a new attempt instead of returning the
previous failure. A retry can never become a second charge.

Closes #126. ADR: [ADR-2026-10-03-checkout-idempotency](../adr/ADR-2026-10-03-checkout-idempotency.md)
([plain-English version](../adr/ADR-2026-10-03-checkout-idempotency-for-dummies.md)).

## What was wrong

- The relay used the key the client sent as the BullMQ job id. The hosted checkout sent
  the session id (payments) or `<planId>-<payer>` (subscriptions), both public. Anyone
  could post a junk body under that key, and for the next hour the real payer got the
  junk job's `failed` view.
- "Try again" re-signed but reused the key, so it got the same failure back.
- `GET /v1/relay/submissions/:key` returned any merchant's submission.

## What shipped

- The relay job id is `relay-pay-<hex>` or `relay-sub-<hex>`, where `<hex>` is the
  keccak256 hash of the signed calldata. It is returned as `idempotencyKey` and is the
  only handle for polling. The identical signed payload maps to the same job.
- Every submission is simulated with `eth_call` from the relayer before it is queued. A
  revert is refused with `400 relay_simulation_failed` and the decoded revert in
  `error.details.revert`.
- `checkoutPaymentNonce(sessionId)` in `@strimz/shared-crypto` (minor release). The
  checkout signs every payment authorization for a session with it, and the relay
  refuses any other nonce for a session with `400 auth_nonce_mismatch`.
- A session in `submitted` is refused with `409 session_already_submitted`.
- One live attempt per payment session, or per plan and payer, tracked in Redis
  (`relay-attempt:pay:<sessionId>`, `relay-attempt:sub:<planId>:<payer>`, 2 hour
  expiry). A new attempt is refused with `409 attempt_in_progress` and the current
  submission in `error.details.submission` while the earlier attempt can still land, or
  with `409 already_settled` once it succeeded on-chain.
- `GET /v1/relay/submissions/:key` is scoped to the caller's merchant and accepts
  `?sessionId=`. The checkout BFF passes the session from its path.
- The checkout hooks no longer send a key, poll the key the POST returns, and follow a
  `409 attempt_in_progress` to the live submission.

## Relay API behaviour change

Breaking for direct callers of the relay endpoints. Only the hosted checkout uses them
today.

- `idempotencyKey` in the `POST /v1/relay/payments` and `POST /v1/relay/subscriptions`
  bodies is optional, accepted and ignored. It is deprecated.
- Polling `GET /v1/relay/submissions/:key` with a key you chose returns `404`. Use the
  `idempotencyKey` from the POST response.
- A submission made by another merchant returns `404`.
- New refusals: `400 relay_simulation_failed`, `400 auth_nonce_mismatch`,
  `409 session_already_submitted`, `409 attempt_in_progress`, `409 already_settled`.
- Each submission costs one extra RPC `eth_call`.

## Deploy

1. Deploy the API and the web app together. A checkout page served by the old web build
   signs with a random nonce, which the new API refuses for a session with
   `auth_nonce_mismatch`; the payer reloads the page.
2. No migration, no contract change, no job payload change.

## Scenario impact

`needs_automation`: the Arc testnet check in the ADR (force the first relay attempt to
fail, press Try again, confirm one `PaymentExecuted` and one token transfer, and that a
POST with the session id as key from another client changes nothing) has not been
automated or run for this change.
