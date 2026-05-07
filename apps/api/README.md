# @strimz/api

The Strimz HTTP API. NestJS 11 on Fastify; PostgreSQL via Prisma; Redis-backed BullMQ for queues; viem for Arc reads.

## Layout

```
src/
├── main.ts                          Fastify bootstrap, helmet, rate-limit, CORS, OpenAPI at /docs
├── app.module.ts                    Wires every module + global filter + global interceptor
├── config/                          Zod-validated env, exposed via TypedConfigService
├── infra/
│   ├── prisma/                      PrismaService (singleton, lifecycle-bound)
│   ├── redis/                       ioredis client (BullMQ, rate-limit, idempotency cache)
│   ├── queue/                       BullMQ named queues — webhook delivery, subscription due, agent action
│   ├── email/                       Resend wrapper
│   └── chain/                       viem PublicClient for Arc
├── common/
│   ├── filters/                     AllExceptionsFilter — emits Strimz error envelope
│   ├── pipes/                       ZodValidationPipe — validates body/query/params against shared-types schemas
│   ├── interceptors/                RequestIdInterceptor — stamps X-Strimz-Request-Id
│   ├── guards/                      ApiKeyGuard (SDK), JwtGuard (dashboard)
│   └── decorators/                  @CurrentMerchant, @Public, @RequireScopes
└── modules/
    ├── auth/                        signup / login / refresh
    ├── merchants/                   /v1/merchants/me  (JWT)
    ├── api-keys/                    /v1/api-keys CRUD (JWT)
    ├── customers/                   /v1/customers (API key)
    ├── payment-sessions/            /v1/payment-sessions (API key)
    ├── transactions/                /v1/transactions read (API key)
    ├── subscription-plans/          /v1/subscription-plans (API key)
    ├── subscriptions/               /v1/subscriptions read + cancel  *(M1 — chain integration TODO)*
    ├── refunds/                     /v1/refunds  *(M1 — wallet-signature flow TODO)*
    ├── webhooks/                    /v1/webhook-endpoints + /v1/webhook-deliveries  *(M1 — TODO)*
    ├── compliance/                  /v1/compliance  *(M2 — TRM/Elliptic TODO)*
    ├── analytics/                   /v1/stats/*  *(M2 — aggregations TODO)*
    ├── agents/                      /v1/agents/*  *(M3)*
    ├── storefronts/                 /v1/storefront  *(M3)*
    ├── invoices/                    /v1/invoices  *(M3)*
    └── health/                      /health, /ready
```

## Auth

| Surface                                                                  | Strategy      | Header                              |
| ------------------------------------------------------------------------ | ------------- | ----------------------------------- |
| `/v1/auth/*`                                                             | none (public) | –                                   |
| `/v1/merchants/*`, `/v1/api-keys/*`, dashboard surface                   | JWT (HS256)   | `Authorization: Bearer <jwt>`       |
| `/v1/payment-sessions/*`, `/v1/customers/*`, every SDK-callable resource | API key       | `Authorization: Bearer sk_test_...` |

The API-key guard hashes the inbound key with `@strimz/shared-crypto` and looks it up by the indexed sha256 hash. Mode (`test`/`live`) is derived from the key prefix.

`@RequireScopes(...)` enforces granular per-route scope checks against the API key's `scopes` array.

## Configuration

Strict Zod validation at boot — see `src/config/env.schema.ts`. The process refuses to start with an invalid `.env`.

| Var                              | Required | Notes                                 |
| -------------------------------- | -------- | ------------------------------------- |
| `NODE_ENV`                       | ✓        | `development` / `test` / `production` |
| `PORT`                           | –        | default `4000`                        |
| `DATABASE_URL`                   | ✓        | shared with `@strimz/db`              |
| `REDIS_URL`                      | ✓        | BullMQ + caches                       |
| `JWT_SECRET`                     | ✓        | 32+ characters                        |
| `STRIMZ_WEBHOOK_SIGNING_SECRET`  | ✓        | HMAC for outbound webhooks            |
| `ARC_RPC_URL`, `ARC_ENVIRONMENT` | ✓        | viem PublicClient seed                |
| `RESEND_API_KEY`                 | –        | falls back to logging if absent (dev) |
| `COMPLIANCE_PROVIDER`            | –        | `disabled` / `trm` / `elliptic`       |
| `CORS_ORIGIN`                    | –        | comma-separated list or `*`           |

## Scripts

| Script                                | Action                                     |
| ------------------------------------- | ------------------------------------------ |
| `pnpm --filter @strimz/api dev`       | `nest start --watch`                       |
| `pnpm --filter @strimz/api build`     | `nest build`                               |
| `pnpm --filter @strimz/api start`     | `node dist/main.js` (prod)                 |
| `pnpm --filter @strimz/api test`      | vitest                                     |
| `pnpm --filter @strimz/api test:e2e`  | full e2e suite (requires Postgres + Redis) |
| `pnpm --filter @strimz/api typecheck` | `tsc --noEmit`                             |
| `pnpm --filter @strimz/api lint`      | ESLint                                     |

## Bootstrap behaviour

- Fastify adapter — faster than Express, native streaming, better TS.
- `helmet` for security headers; CSP off (we control the only consumer for now — the dashboard sets its own CSP).
- `@fastify/rate-limit` — 600 req/min per IP at the edge. Per-merchant tier limits live in a separate guard.
- OpenAPI at `/docs` — auto-generated from controllers. Bearer-key security scheme already declared.
- Global exception filter renders every error in the Strimz envelope shape `{ error: { code, message, requestId, ... } }`. The SDK's `classifyError` parses this directly.
- Global request-id interceptor echoes any inbound `X-Strimz-Request-Id` or generates a UUID v4. Filters and logs use it for traceability.
- `app.enableShutdownHooks()` — Prisma/Redis disconnect cleanly on SIGTERM (Render rolling deploys).

## What's stubbed

Modules tagged _M1 / M2 / M3 — TODO_ in the layout above expose the full route surface but throw `NotImplementedException` for handlers that need integration with chain events, off-chain compliance providers, or aggregation pipelines that don't exist yet. Each stub carries a single-line comment pointing to the work item.
