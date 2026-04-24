<div align="center">

# Strimz

**The B2B subscription billing infrastructure for stablecoin commerce — built on Arc.**

[![CI](https://img.shields.io/github/actions/workflow/status/strimz/strimz/ci.yml?branch=main&label=CI&logo=github)](./.github/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-02C76A.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)](./.nvmrc)
[![pnpm](https://img.shields.io/badge/pnpm-10.x-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![Turborepo](https://img.shields.io/badge/Turborepo-2.x-EF4444?logo=turborepo&logoColor=white)](https://turbo.build)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Foundry](https://img.shields.io/badge/Foundry-Solidity-FFDB1C)](https://book.getfoundry.sh)
[![Arc](https://img.shields.io/badge/Chain-Arc-000000)](https://www.arc.network)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-02C76A.svg)](#contributing)

</div>

---

## Overview

Strimz is a payment gateway that gives any product a USDC billing layer. It accepts one-shot and recurring stablecoin payments, manages subscriptions on-chain, settles instantly with sub-second finality, and exposes the whole flow through an SDK and a hosted checkout. The platform runs on [Arc](https://www.arc.network), Circle's stablecoin-native L1 where gas is paid in USDC.

This repository is the entire platform: smart contracts, backend services, the merchant dashboard, the hosted checkout, the public SDKs, and the infrastructure tooling to run them.

## Table of contents

- [Repository layout](#repository-layout)
- [Tech stack](#tech-stack)
- [System architecture](#system-architecture)
  - [High-level topology](#high-level-topology)
  - [Smart contract layer](#smart-contract-layer)
  - [Backend services](#backend-services)
  - [Frontend](#frontend)
  - [Payment session lifecycle](#payment-session-lifecycle)
  - [Subscription charging lifecycle](#subscription-charging-lifecycle)
  - [Security model](#security-model)
- [Local development](#local-development)
- [Environment configuration](#environment-configuration)
- [Project structure](#project-structure)
- [Deployment targets](#deployment-targets)
- [Contributing](#contributing)
- [License](#license)

## Repository layout

The monorepo is split into deployables (`apps/`) and shared libraries (`packages/`). Every cross-cutting concern lives in a package so that no two apps duplicate logic.

### Apps

| App | Runtime | Purpose |
|---|---|---|
| [`apps/web`](./apps/web) | Next.js 15 | Merchant dashboard, hosted checkout, public marketing, docs |
| [`apps/api`](./apps/api) | NestJS (Node 22) | HTTP API: auth, merchants, sessions, subscriptions, refunds, webhooks |
| [`apps/indexer`](./apps/indexer) | Go | Listens to Arc, projects on-chain events into Postgres, publishes domain events to Redis |
| [`apps/scheduler`](./apps/scheduler) | NestJS (Node 22) | BullMQ workers: subscription charging, webhook delivery, agent jobs |
| [`apps/agent`](./apps/agent) | NestJS (Node 22) | Strimz AutoPay Agent — ERC-8004 identity, ERC-8183 commerce, recovery, routing |

### Packages

| Package | Purpose |
|---|---|
| [`packages/contracts`](./packages/contracts) | Foundry workspace — Solidity contracts, tests, deploy scripts |
| [`packages/sdk`](./packages/sdk) | `@strimz/sdk` — server SDK for Node and Edge runtimes |
| [`packages/sdk-react`](./packages/sdk-react) | `@strimz/sdk-react` — drop-in React components and hooks |
| [`packages/db`](./packages/db) | Prisma schema and generated client, shared by every Node app |
| [`packages/shared-types`](./packages/shared-types) | Zod schemas; TS types inferred from them |
| [`packages/shared-config`](./packages/shared-config) | Chain registry, token registry, fee tiers — single source of truth |
| [`packages/shared-crypto`](./packages/shared-crypto) | HMAC, webhook signing, nonces — runs in Node and Edge |
| [`packages/ui`](./packages/ui) | shadcn primitives configured with Strimz brand tokens |
| [`packages/tsconfig`](./packages/tsconfig) | Shared TypeScript configurations |
| [`packages/eslint-config`](./packages/eslint-config) | Shared ESLint configurations |

### Tooling

| Path | Purpose |
|---|---|
| [`tooling/docker`](./tooling/docker) | Docker Compose stack for local development |
| [`tooling/scripts`](./tooling/scripts) | Release, deploy, and seed scripts |

## Tech stack

| Layer | Technology |
|---|---|
| Language | TypeScript 5.7, Solidity 0.8.x, Go 1.23 |
| Smart contracts | Foundry, OpenZeppelin Contracts |
| Backend HTTP | NestJS 11 (Node 22) |
| Backend workers | NestJS standalone + BullMQ; Go for the indexer |
| Frontend | Next.js 15 (App Router), React 19, Tailwind v4, shadcn/ui |
| Wallet & chain | viem 2.x, wagmi 2.x, Privy |
| Database | PostgreSQL 16, Prisma 6, Redis 7 |
| Validation | Zod 3 |
| Build | Turborepo 2, pnpm 10, tsup |
| Observability | OpenTelemetry, Sentry, Pino |
| Hosting | Vercel (web), Render (api, indexer, scheduler, agent, Postgres, Redis) |

## System architecture

### High-level topology

```
                         ┌──────────────────────────────────────────┐
                         │              Arc Blockchain              │
                         │   StrimzRegistry · Payments · Subs ·     │
                         │   FeeCollector · AgentRegistry · Escrow  │
                         └───────────┬───────────────────┬──────────┘
                                     │ events            │ tx
                                     ▼                   ▲
   ┌────────────┐   HTTP    ┌────────────┐  Redis  ┌────────────┐
   │  Merchant  │ ────────► │            │ stream  │            │
   │   web app  │           │ apps/api   │ ◄─────► │  scheduler │
   │  (Next.js) │ ◄──────── │  (NestJS)  │         │  (NestJS)  │
   └─────┬──────┘  webhooks │            │         │            │
         │                  └────┬───────┘         └────┬───────┘
         │ wallet                │ rw                   │ rw
         │ (viem/wagmi)          ▼                      ▼
         │                  ┌──────────────────────────────────┐
         │                  │     PostgreSQL 16 (Render)       │
         │                  │     (source of read state)       │
         │                  └──────────────────────────────────┘
         │                                ▲ rw
         │                                │
         │                  ┌────────────┐│
         │                  │  indexer   ├┘
         │                  │   (Go)     │
         │                  └─────┬──────┘
         │                        │ event subscribe (JSON-RPC)
         ▼                        ▼
   ┌────────────┐           ┌──────────────────────────────────┐
   │  payer's   │           │              Arc                 │
   │   wallet   │ ────────► │  (USDC gas, native EURC, USYC)   │
   └────────────┘           └──────────────────────────────────┘

                            ┌────────────┐
                            │   agent    │  (M3+) listens to Redis
                            │  (NestJS)  │  events, executes ERC-8004
                            └────────────┘  identity + ERC-8183 jobs
```

The contract is the source of truth for money. Postgres is a read-side projection of the chain. Webhooks are the merchant's view of the projection.

### Smart contract layer

Located in [`packages/contracts/src`](./packages/contracts/src). Built and tested with [Foundry](https://book.getfoundry.sh).

**Modules.**

| Module | Contracts |
|---|---|
| `core/` | `StrimzRegistry`, `StrimzPayments`, `StrimzSubscriptions` |
| `fees/` | `FeeCollector` |
| `tokens/` | `TokenWhitelist` |
| `access/` | `StrimzAccessControl`, `Pausable` |
| `agent/` | `StrimzAgentRegistry` (ERC-8004), `StrimzAgentEscrow` (ERC-8183) |
| `interfaces/` | One interface per public contract |

**Design rules.**

- **Registry-backed merchants.** Merchants are identified by an on-chain id. `StrimzRegistry` holds the merchant's payout address, fee bps, and active flag. Payments and subscriptions read from the registry, so payout addresses can rotate without redeploying.
- **Idempotent subscription charges.** Every charge call carries a `bytes32 chargeAttemptId`. The contract rejects reused ids. This eliminates the double-charge class of bugs that polling cron jobs are prone to.
- **Events as the canonical projection source.** Contracts emit rich events (`PaymentExecuted`, `SubscriptionCharged`, `FeeAccrued`, `RefundRecorded`). The indexer rebuilds Postgres from these events, so the database is reconstructable from chain history at any time.
- **Selective upgradeability.** `StrimzRegistry` and `FeeCollector` are upgradeable (UUPS) because policy changes. `StrimzPayments` and `StrimzSubscriptions` are immutable; new versions are deployed and re-pointed via the registry.
- **Pull payments for fees.** Fees accrue to `FeeCollector`. The treasury withdraws on a schedule. This shrinks the reentrancy surface and isolates accounting.
- **Owner-pausable kill switch.** Every value-moving function respects `Pausable`. If something is wrong, all transfers halt at once.

### Backend services

Three Node services (NestJS) and one Go service. Each runs as its own process so that a slow webhook delivery cannot block a payment session, and a stuck cron cannot block the API.

**`apps/api` — HTTP API.** Module-per-bounded-context layout. Examples: `merchants`, `api-keys`, `payment-sessions`, `subscriptions`, `refunds`, `webhooks`, `compliance`, `analytics`, `agents`. Common cross-cutting concerns (`ApiKeyGuard`, `JwtGuard`, `TierGuard`, `ZodValidationPipe`, `StrimzError` filter) live in `common/`. Side effects (Prisma, Redis, BullMQ, Resend, viem) live in `infra/` and are injected through interfaces. Controllers validate and delegate; services hold the domain rules; repositories own persistence. The API never reads from the chain directly — it reads from Postgres, which the indexer keeps current.

**`apps/indexer` — chain projector (Go).** Subscribes to Arc events using `go-ethereum`. For each event it: parses to a domain event, writes to Postgres (advancing a per-contract cursor), and publishes to a Redis stream so the scheduler and agent can react in real time. Go is chosen here because indexers are bounded by I/O concurrency and stable long-running connections — a domain Go is genuinely best at. Resumable on restart, idempotent on replay.

**`apps/scheduler` — workers.** NestJS standalone app backed by BullMQ. Three queues:
- `subscription.due` — cron-driven; reads due subscriptions from Postgres, calls `batchCharge` on the contract with one `chargeAttemptId` per subscription, writes the result.
- `webhook.deliver` — exponential backoff (1m → 5m → 30m → 2h → 24h), then dead-lettered with merchant alert.
- `agent.action` — drives the AutoPay Agent's scheduled actions (subscription recovery retries, daily cash flow digests).

**`apps/agent` — Strimz AutoPay Agent (M3+).** NestJS service holding the agent's ERC-8004 identity, signing ERC-8183 escrow operations, and orchestrating the recovery, routing, cashflow, and commerce flows. Listens to the Redis event stream the indexer publishes; reacts within a bounded SLA. Configurable per-merchant via `AgentConfig`.

### Frontend

`apps/web` is a single Next.js 15 App Router application that hosts three audiences in route groups:

- `(marketing)` — public landing, pricing, docs.
- `(auth)` — merchant sign-in and sign-up.
- `(dashboard)` — authenticated merchant surface (overview, transactions, subscriptions, customers, refunds, webhooks, API keys, agent settings, storefront, invoices, treasury, billing, settings).
- `checkout/[sessionId]` — the payer-facing hosted checkout, intentionally isolated so it can later be embedded in iframes without dashboard chrome leaking.
- `invoice/[id]` — the public invoice page.

Server components are the default; only interactive leaves (wallet connect, charts, forms) are client components. Forms use React Hook Form with the same Zod schemas the API validates against — there is no opportunity for client and server to disagree on shape. Server state is owned by TanStack Query; client state is small and lives in component-local React state or thin Zustand slices. Wallet integration uses viem 2.x and wagmi 2.x with Privy as the embedded-wallet provider.

### Payment session lifecycle

```
1. Merchant calls @strimz/sdk:           strimz.sessions.create({ amount, currency, ... })
2. SDK → POST /v1/payment-sessions       (api validates, persists row, returns sessionId + checkoutUrl)
3. Merchant redirects payer →            apps/web/checkout/[sessionId]
4. Payer connects wallet                 (viem/wagmi/Privy)
5. Payer signs ERC20 approval            (one tx, USDC/EURC, gas paid in USDC on Arc)
6. Payer signs StrimzPayments.pay        (contract pulls funds, splits fee, emits PaymentExecuted)
7. Indexer ingests event                 (writes Transaction, advances cursor, publishes to Redis)
8. Scheduler picks up webhook job        (delivers to merchant URL, signed with HMAC-SHA256)
9. Merchant verifies signature            (via @strimz/sdk verifyWebhookSignature)
```

Every step after (6) is asynchronous and idempotent. If any step fails, the chain remains the source of truth and the projection rebuilds.

### Subscription charging lifecycle

```
A. Merchant defines a SubscriptionPlan   (price, interval, currency, gracePeriod)
B. Customer subscribes                   (signs unlimited ERC20 approval to StrimzSubscriptions)
C. scheduler runs subscription.due cron  (every 5 min; finds subscriptions where nextChargeAt <= now)
D. Worker generates chargeAttemptId      (UUID; persisted on the SubscriptionCharge row)
E. Worker calls batchCharge(ids, attempts)
   ├─ Contract checks each subscription is active and chargeAttemptId is unused
   ├─ For each: pulls funds, splits fee, emits SubscriptionCharged
   └─ Returns a per-id outcome bitmap (charged | insufficient | revoked)
F. Indexer ingests events                (updates SubscriptionCharge status)
G. On insufficient funds:
   ├─ Worker schedules a retry inside the merchant's grace period
   ├─ AutoPay Agent (M3+) sends payer a low-balance reminder
   └─ If grace expires, subscription is marked at_risk and emits subscription.lapsed webhook
H. Webhook delivery same as above
```

Two properties hold by construction:
1. A subscription is never double-charged for the same period (idempotency at the contract level via `chargeAttemptId`).
2. A subscription cancelled on-chain between cron tick and worker run is skipped (the contract rejects, the worker records the outcome).

### Security model

- **Strimz never holds keys.** The platform stores wallet addresses only. Merchants and payers sign every value-moving transaction from their own wallet. There are no encrypted seed phrases anywhere in the database.
- **API keys.** Stored as `prefix + sha256(key)`. The full key is shown exactly once at creation. Test and live keys are entirely separate; calling a live endpoint with a test key is a typed error.
- **Webhook signatures.** Every webhook is signed with HMAC-SHA256 over `t=<unix>,v1=<hex>`. Merchants verify with [`@strimz/sdk`](./packages/sdk). Signatures older than 5 minutes are rejected to prevent replay.
- **Role-based access inside merchants.** Owner / Admin / Developer / Read-only. Refunds, key rotation, and tier changes are gated by role.
- **Rate limiting.** Per-API-key in Redis, per-IP at the edge. The limits are tier-aware.
- **Transactional audit log.** Every mutating action writes an `AuditLog` row. Refunds, key rotations, tier changes, agent enable/disable.
- **Contract security.** Independent third-party audit before any mainnet deployment. `Pausable` kill switch on every value-moving function. `Ownable` and `AccessControl` for privileged ops with a multi-sig treasury.
- **Secrets.** No secrets in the repo. `.env.example` files are committed; real `.env` files are gitignored. Production secrets live in Render's environment manager.

## Local development

### Prerequisites

- Node 22 (`nvm use` to match `.nvmrc`)
- pnpm 10 (`corepack enable && corepack prepare pnpm@10 --activate`)
- Docker (for the local Postgres + Redis + Anvil stack)
- Foundry (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- Go 1.23 (only required to develop the indexer)

### First-time setup

```sh
git clone <repo-url> strimz
cd strimz
pnpm install
cp tooling/docker/.env.example tooling/docker/.env   # local-stack creds, optional
docker compose --file tooling/docker/docker-compose.yml up -d
pnpm --filter @strimz/db db:migrate
pnpm --filter @strimz/contracts forge:install
pnpm dev                                              # runs every app via Turbo
```

### Useful scripts

| Command | Description |
|---|---|
| `pnpm dev` | Run all apps in watch mode |
| `pnpm build` | Build everything via Turbo |
| `pnpm lint` | Lint everything |
| `pnpm typecheck` | Typecheck everything |
| `pnpm test` | Test everything |
| `pnpm format` | Prettier write |
| `pnpm changeset` | Create a changeset for an SDK release |
| `pnpm --filter @strimz/contracts forge:test` | Run Foundry tests |
| `pnpm --filter @strimz/db db:migrate` | Apply Prisma migrations |
| `pnpm --filter web dev` | Run only the web app |

## Environment configuration

Each app has its own `.env.example` listing required and optional variables. Copy each one to `.env` for local use. Production values live in Render and Vercel, never in the repo. Recurring variables across apps:

| Variable | Used by | Purpose |
|---|---|---|
| `DATABASE_URL` | api, indexer, scheduler, agent | Postgres connection string |
| `REDIS_URL` | api, scheduler, agent | Redis connection string |
| `ARC_RPC_URL` | api, indexer, scheduler, agent | Arc JSON-RPC endpoint |
| `ARC_CHAIN_ID` | all | Chain id (`5042002` testnet) |
| `STRIMZ_REGISTRY_ADDRESS` | all | Deployed `StrimzRegistry` address |
| `STRIMZ_WEBHOOK_SIGNING_SECRET` | api, scheduler | HMAC secret for webhook signatures |
| `JWT_SECRET` | api | Merchant session JWT secret |
| `PRIVY_APP_ID` / `PRIVY_APP_SECRET` | web, api | Wallet auth |
| `RESEND_API_KEY` | api, scheduler | Transactional email |
| `SENTRY_DSN` | all | Error tracking (optional in dev) |

## Project structure

```
strimz/
├── apps/
│   ├── web/              Next.js 15 — dashboard, checkout, marketing
│   ├── api/              NestJS HTTP API
│   ├── indexer/          Go chain projector
│   ├── scheduler/        NestJS BullMQ workers
│   └── agent/            NestJS AutoPay Agent (M3+)
├── packages/
│   ├── contracts/        Foundry workspace
│   ├── sdk/              @strimz/sdk
│   ├── sdk-react/        @strimz/sdk-react
│   ├── db/               Prisma schema + client
│   ├── shared-types/     Zod schemas
│   ├── shared-config/    Chains, tokens, tiers
│   ├── shared-crypto/    HMAC, webhook verify
│   ├── ui/               shadcn + Strimz brand
│   ├── tsconfig/         Base TS configs
│   └── eslint-config/    Base ESLint configs
├── tooling/
│   ├── docker/           Local Compose stack
│   └── scripts/          Release + deploy helpers
├── .github/workflows/    CI pipelines
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

## Deployment targets

| Surface | Host |
|---|---|
| `apps/web` | Vercel |
| `apps/api` | Render — Web Service |
| `apps/indexer` | Render — Background Worker |
| `apps/scheduler` | Render — Background Worker |
| `apps/agent` | Render — Background Worker |
| Postgres 16 | Render — Managed PostgreSQL |
| Redis 7 | Render — Managed Key Value |
| Smart contracts | Arc testnet (`5042002`), then Arc mainnet |

## Contributing

- Create a branch from `main`. Branch naming: `feat/<scope>`, `fix/<scope>`, `chore/<scope>`.
- Conventional commits: `feat(api): ...`, `fix(contracts): ...`, `chore(repo): ...`.
- Every SDK-touching PR ships a [changeset](https://github.com/changesets/changesets).
- `pnpm lint && pnpm typecheck && pnpm test` must pass.
- Contract changes require Foundry tests, including invariant tests for value-moving functions.

## License

[MIT](./LICENSE) © 2026 Strimz.
