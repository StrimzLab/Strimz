---
date: 2026-10-10
feature: Hosted checkout calls the API directly, and merchant keys relay only for their own merchant
scope: fix
scenario-impact: needs_automation
---

# Relay abuse, part 2: hosted checkout without a shared key, merchant keys bound to their merchant

The hosted checkout now sends a payer's signed payment or enrolment straight from the
browser to the public checkout relay routes added in part 1, and polls their public
submission routes. The web app's checkout proxy and the merchant API key it held are
gone. `POST /v1/relay/payments` and `POST /v1/relay/subscriptions` now relay only for the
merchant that owns the key, and only for one of its payment sessions or plans.

This is the second of two pull requests for #125. ADR:
[ADR-2026-10-08-relay-abuse](../adr/ADR-2026-10-08-relay-abuse.md)
([plain-English version](../adr/ADR-2026-10-08-relay-abuse-for-dummies.md)).
Part 1: [2026-10-10-relay-abuse](./2026-10-10-relay-abuse.md).

## What was wrong

- Any `relay_write` key could relay a payment or enrolment naming any merchant's on-chain
  id, with or without a session or plan.
- The hosted checkout relayed every merchant's payments through a proxy in the web app
  that held one merchant's secret key (`STRIMZ_INTERNAL_API_KEY`), so every hosted
  submission was attributed to that one merchant.
- Hosted subscription checkout failed with `400 enrolment_terms_mismatch` for every
  merchant except that key's owner, because the plan check compares the plan's merchant
  with the caller.

## What shipped

- The hosted payment page posts to `POST /v1/checkout/sessions/:id/relay` and polls
  `GET /v1/checkout/sessions/:id/submissions/:key`; the hosted subscription page posts to
  `POST /v1/checkout/plans/:id/relay` and polls `GET /v1/checkout/plans/:id/submissions/:key`.
  Both call the API origin from `NEXT_PUBLIC_API_URL`, which the API already allows from
  the browser and the web app's `connect-src` already lists.
- The payer sees a plain message for `insufficient_balance`, `amount_below_minimum`,
  `relay_budget_exhausted`, `rate_limited` and `subscription_exists`, and the API's own
  message for any other refusal. A `409 attempt_in_progress` still resumes polling the
  earlier attempt.
- Removed from the web app: `POST /api/checkout/sessions/:sessionId/submit`,
  `GET /api/checkout/sessions/:sessionId/submissions/:idempotencyKey`,
  `src/lib/strimz-bff.ts`, and `STRIMZ_INTERNAL_API_KEY` from `.env.example`.
- On `POST /v1/relay/payments` and `POST /v1/relay/subscriptions`, the body `merchantId`
  must be the caller's on-chain merchant id, otherwise `403 merchant_mismatch`. A
  merchant with no on-chain id gets the same answer. The check runs before the body is
  otherwise validated, before any session or plan lookup and before simulation.
- `sessionId` is required on payments and `subscriptionInternalId` on enrolments:
  `400 invalid_request` without it. The session, nonce, amount, token, plan and
  attempt checks therefore always run on the merchant-key path, the same as on the
  public path.

## Relay API behaviour change (breaking)

For merchants calling `/v1/relay/*` directly:

- Send `sessionId` with every payment and `subscriptionInternalId` (the plan id) with
  every enrolment. Without it the call is `400 invalid_request`.
- Relay only for your own merchant: any other `merchantId` is `403 merchant_mismatch`,
  and a session or plan of another merchant is refused the same way.
- Finish on-chain merchant registration before relaying; until then every call is
  `403 merchant_mismatch`.
- No SDK method calls these routes, so no SDK release is needed.

## Deploy

Vercel deploys the web on merge. Until the Lightsail API is redeployed at or after this
commit (with `prisma migrate deploy` for part 1's `RelayDailyUsage`, `OPS_ALERT_EMAIL`
set, and part 1's below-floor counts run first), the hosted checkout calls
`/v1/checkout/.../relay` routes the live API does not have, and every hosted payment and
enrolment fails with `404`. Either redeploy the API right after merging, or hold the
Vercel production deploy until the API is redeployed.

1. Run part 1's below-floor counts and share them
   (see [2026-10-10-relay-abuse](./2026-10-10-relay-abuse.md#deploy)).
2. Redeploy the API (`infra/lightsail/deploy.sh`) with `prisma migrate deploy` and
   `OPS_ALERT_EMAIL` set. This pull request adds no migration.
3. Let the web deploy (or promote the held Vercel production deploy).
4. Only after both are live: revoke the old `STRIMZ_INTERNAL_API_KEY` in the dashboard of
   the merchant account that owns it, and delete the variable from the Vercel project.

## Scenario impact

`needs_automation`: covered by API e2e and web unit tests. The Arc testnet check in the
ADR has not been run: pay a hosted session and enrol into a plan of a merchant that is
not the old key's owner (with the transaction hashes), confirm a 1-unit self-signed
payment to another merchant is refused with `403 merchant_mismatch`, then revoke the old
key and confirm hosted checkout still works.
