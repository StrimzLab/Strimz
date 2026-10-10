---
date: 2026-10-10
feature: Hosted checkout can relay without an API key, and relayed gas is bounded per merchant
scope: fix
scenario-impact: needs_automation
---

# Relay abuse, part 1: public checkout relay routes and gas bounds

The API now has public, session-bound relay routes for the hosted checkout, so a payment
or enrolment no longer needs one merchant's API key and is always attributed to the
merchant who is paid. Every relayed call moves at least 1.00 of a stablecoin, enrolments
need a funded payer, the relay routes are rate limited, and each merchant has a daily
relay budget with an operator alert.

This is the first of two pull requests for #125. ADR:
[ADR-2026-10-08-relay-abuse](../adr/ADR-2026-10-08-relay-abuse.md)
([plain-English version](../adr/ADR-2026-10-08-relay-abuse-for-dummies.md)).

## What was wrong

- Any `relay_write` key could relay a 1 base unit payment to any merchant, signed by the
  caller's own wallet. Each one cost the relayer up to 0.056 USDC of gas, repeatable
  without limit.
- The hosted checkout relayed every merchant's payments through one merchant's key, and
  hosted subscription checkout failed with `400 enrolment_terms_mismatch` for every
  merchant except that key's owner.
- A session payment could use a token other than the session currency.
- An enrolment moves no money, so an empty wallet could enrol for free gas.
- The relay routes had no rate limit, and `keyBy: 'actor'` limits were in fact per IP.

## What shipped

- `POST /v1/checkout/sessions/:id/relay`, `POST /v1/checkout/plans/:id/relay`,
  `GET /v1/checkout/sessions/:id/submissions/:key` and
  `GET /v1/checkout/plans/:id/submissions/:key`, public. The session or plan decides the
  merchant; every session and plan check of the merchant-key routes runs against it, and
  the relay job's `merchantInternalId` is the merchant who owns it. Both routes share one
  code path with `POST /v1/relay/*`.
- A payment for a session must use the session currency's token:
  `400 token_mismatch`, on both paths.
- 1.00 minimum (`1000000` base units): `400 amount_below_minimum` on relayed payments and
  enrolments, before simulation, and when a payment session, subscription plan,
  storefront product or invoice is created.
- An enrolment reads `balanceOf(payer)` of the signed token and refuses a payer holding
  less than the amount: `400 insufficient_balance`, trial plans included.
- Rate limits: 20 a minute per client address on each public relay `POST`, 120 a minute
  on each public lookup, 60 a minute per merchant on each of `POST /v1/relay/payments`
  and `POST /v1/relay/subscriptions`. `keyBy: 'actor'` now reads the authenticated
  merchant or admin.
- Daily relay budget per merchant, per UTC day: free 500, growth 5,000, business 50,000,
  enterprise 50,000 new submissions. A replay or an already-paid session does not count.
  Over budget is `429 relay_budget_exhausted` with `error.details.retryAfterSec` until
  00:00 UTC. At 80% and at 100% the API logs `relay.budget` at `warn` / `error` and sends
  one email to `OPS_ALERT_EMAIL`, once each per merchant per day.
- The relay worker adds `gasUsed * effectiveGasPrice` of each relayed payment and
  enrolment to the merchant's daily usage row.
- New table `RelayDailyUsage` (one migration).

## Relay API behaviour change

For merchants calling `/v1/relay/*` directly:

- Payments and enrolments below 1.00 are refused with `400 amount_below_minimum`.
- With a `sessionId`, a token other than the session currency's is refused with
  `400 token_mismatch`.
- An unfunded payer's enrolment is refused with `400 insufficient_balance`.
- 60 calls a minute per merchant per route, and the daily budget above.
- `sessionId` and `subscriptionInternalId` stay optional, and the body `merchantId` is not
  yet bound to the caller. Both change in part 2, after the hosted checkout has moved to
  the public routes.

## Deploy

1. Before deploying, count the rows that become unpayable and share the numbers:

   ```sql
   SELECT 'payment_sessions' AS kind, count(*) FROM "PaymentSession"
     WHERE status IN ('created', 'awaiting_payment') AND amount::numeric < 1000000;
   SELECT 'subscription_plans' AS kind, count(*) FROM "SubscriptionPlan"
     WHERE status = 'active' AND amount::numeric < 1000000;
   SELECT 'storefront_products' AS kind, count(*) FROM "StorefrontProduct"
     WHERE "isActive" AND price::numeric < 1000000;
   SELECT 'unpaid_invoices' AS kind, count(*) FROM "Invoice"
     WHERE status IN ('draft', 'sent', 'overdue') AND total::numeric < 1000000;
   ```

   Those rows are left as they are and are refused at relay with
   `amount_below_minimum`.

2. Run the migration (`prisma migrate deploy`). It only creates `RelayDailyUsage`.
3. Set `OPS_ALERT_EMAIL` on the API. It is optional; without it the budget alerts are
   logged only.
4. Deploy the API. The web app is unchanged and keeps working through its BFF.

## Scenario impact

`needs_automation`: the Arc testnet check in the ADR (pay a hosted session and enrol into
a plan of a merchant who is not the old key's owner, with the transaction hashes) needs
part 2's web change and has not been automated or run.
