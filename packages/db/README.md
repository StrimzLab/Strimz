# @strimz/db

Prisma schema and generated PostgreSQL client for the Strimz platform.

## Layout

```
packages/db/
├── prisma/
│   └── schema/
│       ├── schema.prisma              Datasource + generator
│       ├── enums.prisma               All platform enums (kept in sync with shared-types)
│       ├── merchants.prisma           Merchant, MerchantMember, MerchantApiKey
│       ├── customers.prisma           Customer
│       ├── payments.prisma            PaymentSession
│       ├── transactions.prisma        Transaction
│       ├── subscriptions.prisma       SubscriptionPlan, Subscription, SubscriptionCharge
│       ├── refunds.prisma             Refund
│       ├── webhooks.prisma            MerchantWebhookEndpoint, WebhookEvent, WebhookDelivery
│       ├── compliance.prisma          ComplianceLog
│       ├── agents.prisma              AgentIdentity, AgentMerchantConfig, AgentActivityLog, AgentJob
│       ├── storefronts.prisma         Storefront, StorefrontProduct
│       ├── invoices.prisma            Invoice
│       └── operations.prisma          IndexerCursor, AuditLog
├── src/
│   ├── client.ts                      createPrismaClient factory
│   └── index.ts                       Re-exports everything
└── generated/                         prisma-generated client (gitignored)
```

## Scripts

| Script | Action |
|---|---|
| `pnpm --filter @strimz/db db:generate` | Generate the Prisma client into `generated/` |
| `pnpm --filter @strimz/db db:migrate` | Create and apply a new migration in dev |
| `pnpm --filter @strimz/db db:migrate:deploy` | Apply pending migrations in production |
| `pnpm --filter @strimz/db db:push` | Push schema to the database without migrations (dev only) |
| `pnpm --filter @strimz/db db:studio` | Open Prisma Studio |
| `pnpm --filter @strimz/db db:reset` | Drop, recreate, migrate, seed |
| `pnpm --filter @strimz/db db:validate` | Validate schema |
| `pnpm --filter @strimz/db db:format` | Format schema files |

## Usage

```ts
import { createPrismaClient, type Merchant } from '@strimz/db'

const prisma = createPrismaClient()

const merchant: Merchant | null = await prisma.merchant.findUnique({
  where: { email: 'ops@strimz.io' },
})
```

## Design notes

- **Multi-file schema** via the `prismaSchemaFolder` preview feature. One file per bounded context.
- **Token amounts are `String(78)`** so we can carry up to uint256 without losing precision. Formatting is the consumer's responsibility.
- **Every FK defaults to `Restrict`** for money-moving tables. Merchants and transactions are never hard-deleted; soft-close via status fields instead.
- **`chargeAttemptId` is unique on `SubscriptionCharge`** — the scheduler enforces contract-level idempotency at the database level first.
- **Enums live in `enums.prisma`** and must stay in sync with the corresponding `@strimz/shared-types` Zod enums. Snake-cased values match the Zod `.enum([...])` shape.
- **No soft-delete flag columns**; explicit status enums per domain are used instead (Merchant `closed`, Plan `archived`, Subscription `cancelled`, etc.).
- **Audit log is central** — every mutating action writes a row. Actors, targets, and diffs are captured.

## Database target

PostgreSQL 16 on Render (managed). Local development uses Postgres 16 via `docker compose` in `tooling/docker/`.
