---
date: 2026-10-03
feature: Every merchant route checks the API key's scopes, and key minting cannot widen a key
scope: fix
scenario-impact: needs_automation
---

# API key scopes are enforced on every route

An API key now reaches only the routes its scopes name. Routes that change where money
goes or what it costs accept only a dashboard session. A key that manages keys can no
longer mint a key wider than itself or touch keys of the other mode, and live keys are
only minted for eligible merchants once live mode opens.

Closes #127. ADR: [ADR-2026-10-03-api-key-scope-enforcement](../adr/ADR-2026-10-03-api-key-scope-enforcement.md)
([plain-English version](../adr/ADR-2026-10-03-api-key-scope-enforcement-for-dummies.md)).

## What was wrong

- A route without `@RequireScopes` was open to any valid secret key of the merchant. 26
  routes had none, among them `PATCH /v1/merchants/me` and `POST /v1/merchants/me/onboard`
  (payout address), `POST /v1/merchants/me/tier` (fee tier) and the customer and
  analytics reads.
- A key with `api_keys_write` could mint a key with any scopes and either mode, and could
  rotate or revoke keys of the other mode.
- Live keys were minted without checking live-mode eligibility.

## What shipped

- **Fail closed.** `MerchantAuthGuard` and `ApiKeyGuard` share one check. An API key gets
  403 `permission_denied` on a route that declares neither `@RequireScopes(...)` nor the
  new `@SessionOnly()`. The dashboard (Privy) path is unchanged.
- **Session-only routes**, 403 `permission_denied` ("route requires a dashboard session")
  for every key: `PATCH /v1/merchants/me`, `POST /v1/merchants/me/onboard`,
  `POST /v1/merchants/me/tier`, `GET /v1/notifications`,
  `POST /v1/notifications/mark-all-read`.
- **New scopes** `merchants_read`, `customers_read`, `customers_write`, `analytics_read`,
  in `apiKeyScopeSchema` and the `ApiKeyScope` enum.

  | Scope               | Routes                                                                                          |
  | ------------------- | ----------------------------------------------------------------------------------------------- |
  | `merchants_read`    | `GET /v1/merchants/me`, `/live-mode-eligibility`, `/chain-status`, `/onchain-state`, `/balance` |
  | `customers_read`    | `GET /v1/customers`, `GET /v1/customers/:id`                                                    |
  | `customers_write`   | `POST /v1/customers`                                                                            |
  | `analytics_read`    | `GET /v1/stats/conversion`, `/churn`, `/mrr`, `/ltv`, `/forecast`                               |
  | `storefronts_read`  | `GET /v1/storefront`, `GET /v1/storefront/products`, `GET /v1/storefront/products/:id`          |
  | `storefronts_write` | `POST /v1/storefront`, `/publish`, `/archive`, `/products`, `/products/:id/archive`             |

- **Key minting by a key.** `POST /v1/api-keys` from a key: every requested scope must be
  held by the calling key and `mode` must equal its mode, otherwise 403
  `permission_denied`. List, retrieve, revoke and rotate see only keys of the calling
  key's mode; another mode's key is 404 `not_found`. Rotate also requires the target's
  scopes to be held by the calling key. A dashboard session keeps full control.
- **Live minting.** Creating a live key, or rotating one, returns 403
  `live_mode_unavailable` while the API is not running against Arc mainnet
  (`ARC_ENVIRONMENT` is not `mainnet`). On mainnet it checks
  `MerchantsService.liveModeEligibility` and returns 403 `live_mode_ineligible` with
  `error.details.reasons` when a check fails. Nothing is written in either case.
- Migrations `20261003120000_api_key_scopes_merchants_customers_analytics` (enum values)
  and `20261003120100_api_key_full_access_scope_backfill` (appends the four new scopes to
  every unrevoked key that holds all 19 earlier scopes). Postgres cannot use an enum value
  in the transaction that adds it, so they are separate.
- `@strimz/shared-types` and `@strimz/sdk` minor changeset. `strimz.merchants.update()`
  and `strimz.merchants.changeTier()` are deprecated and stop working with a secret key.
- Docs: `authentication.mdx` lists the real scopes and the session-only routes,
  `dashboard/api-keys.mdx` states the subset and same-mode rules, `errors.mdx` adds
  `live_mode_ineligible` and `live_mode_unavailable`.

## Deploy

1. Run `prisma migrate deploy` before starting the new API. It applies the enum
   migration, then the backfill. The Lightsail container entrypoint already runs it
   before supervisord starts the API. Starting the new API first leaves full-access keys
   without the four new scopes, so they get 403 on the 26 routes until the backfill runs.
2. Start the new API right after the migrations. The previous API's Prisma client does
   not know the four new enum values, and backfilled keys carry them; this was not tested
   against the previous API, so do not leave it serving on the migrated database.
3. Deploy the web app so the New key dialog lists the new scopes.
4. Only the API reads `MerchantApiKey`; the scheduler, agent and indexer are unaffected.

## Behaviour change for integrators

- A key that is not full access (did not hold all 19 earlier scopes) loses the 26 routes
  above until it is reissued with the scopes it needs. Expect 403 `permission_denied`.
  Pre-launch this affects test-mode integrations only.
- `strimz.merchants.update()`, `strimz.merchants.changeTier()` and direct calls to the
  session-only routes return 403 for every key. Make those changes in the dashboard.
- A key minting keys through the API must hold every scope it grants and stay in its own
  mode.
- Live keys cannot be created or rotated until Strimz runs on Arc mainnet.

## Not covered here

- The dashboard path takes its mode from `x-strimz-mode` with no eligibility check.
- `POST /v1/merchants/me/tier` has no billing step for dashboard sessions.
- `ApiKeyGuard` and `MerchantAuthGuard` still duplicate key resolution; only the scope
  check is shared.
