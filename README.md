# Strimz

**Subscription billing for businesses that get paid in stablecoins.**

[![CI](https://img.shields.io/github/actions/workflow/status/StrimzLab/Strimz/ci.yml?branch=main&label=CI&logo=github)](./.github/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-02C76A.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white)](./.nvmrc)
[![pnpm](https://img.shields.io/badge/pnpm-10.x-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![Turborepo](https://img.shields.io/badge/Turborepo-2.x-EF4444?logo=turborepo&logoColor=white)](https://turbo.build)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Foundry](https://img.shields.io/badge/Foundry-Solidity-FFDB1C)](https://book.getfoundry.sh)
[![Arc](https://img.shields.io/badge/Chain-Arc-000000)](https://www.arc.network)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-02C76A.svg)](#contributing)

---

## Overview

Strimz is a USDC billing layer for businesses that want to charge
customers on-chain without building the on-chain plumbing
themselves. The platform handles one-shot charges, recurring
subscriptions, refunds, invoices, agent escrow, and cross-chain
settlement. Everything settles on [Arc](https://www.arc.network),
Circle's stablecoin-native L1, in roughly 13 seconds.

Customers see a hosted checkout. Developers see an SDK. The
contracts enforce idempotency themselves, so a retried charge can
never become a double charge, and there is no chargeback window.

This repository is the entire platform: smart contracts, backend
services, merchant dashboard, hosted checkout, public SDKs, and the
infrastructure tooling that runs them.

## Quick start

Server-side, after issuing an `sk_test_` key in the dashboard:

```ts
import { Strimz } from '@strimz/sdk'

const strimz = new Strimz({ apiKey: process.env.STRIMZ_KEY! })

const session = await strimz.paymentSessions.create({
  amount: '50000000', // 50 USDC, 6 decimals
  currency: 'USDC',
  description: 'Pro plan, August',
  successUrl: 'https://your-site.com/thanks',
})

console.log(session.checkoutUrl)
```

Send the customer to `session.checkoutUrl`. They connect a wallet,
sign one EIP-3009 authorisation, and the relayer broadcasts the
on-chain transaction. You receive `payment.completed` over a signed
webhook the moment it confirms.

The full walkthrough lives in
[`apps/web/content/docs/quickstart.mdx`](./apps/web/content/docs/quickstart.mdx).

## Table of contents

- [Quick start](#quick-start)
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
  - [Prerequisites](#prerequisites)
  - [First-time setup](#first-time-setup)
  - [Useful scripts](#useful-scripts)
  - [Continuous integration](#continuous-integration)
- [Environment configuration](#environment-configuration)
- [Project structure](#project-structure)
- [Deployment targets](#deployment-targets)
- [Contributing](#contributing)
- [License](#license)

## Repository layout

The monorepo is split into deployables (`apps/`) and shared libraries (`packages/`). Every cross-cutting concern lives in a package so that no two apps duplicate logic.

### Apps

| App                                  | Runtime          | Purpose                                                                                  |
| ------------------------------------ | ---------------- | ---------------------------------------------------------------------------------------- |
| [`apps/web`](./apps/web)             | Next.js 15       | Merchant dashboard, hosted checkout, public marketing, docs                              |
| [`apps/api`](./apps/api)             | NestJS (Node 22) | HTTP API: auth, merchants, sessions, subscriptions, refunds, webhooks                    |
| [`apps/indexer`](./apps/indexer)     | Go               | Listens to Arc, projects on-chain events into Postgres, publishes domain events to Redis |
| [`apps/scheduler`](./apps/scheduler) | NestJS (Node 22) | BullMQ workers: subscription charging, webhook delivery, agent jobs                      |
| [`apps/agent`](./apps/agent)         | NestJS (Node 22) | Strimz AutoPay Agent. ERC-8004 identity, ERC-8183 commerce, recovery, routing            |

### Packages

| Package                                              | Purpose                                                           |
| ---------------------------------------------------- | ----------------------------------------------------------------- |
| [`packages/contracts`](./packages/contracts)         | Foundry workspace. Solidity contracts, tests, deploy scripts      |
| [`packages/sdk`](./packages/sdk)                     | `@strimz/sdk`. Server SDK for Node and Edge runtimes              |
| [`packages/sdk-react`](./packages/sdk-react)         | `@strimz/sdk-react`. Drop-in React components and hooks           |
| [`packages/db`](./packages/db)                       | Prisma schema and generated client, shared by every Node app      |
| [`packages/shared-types`](./packages/shared-types)   | Zod schemas; TS types inferred from them                          |
| [`packages/shared-config`](./packages/shared-config) | Chain registry, token registry, fee tiers. Single source of truth |
| [`packages/shared-crypto`](./packages/shared-crypto) | HMAC, webhook signing, nonces. Runs in Node and Edge              |
| [`packages/ui`](./packages/ui)                       | shadcn primitives configured with Strimz brand tokens             |
| [`packages/tsconfig`](./packages/tsconfig)           | Shared TypeScript configurations                                  |
| [`packages/eslint-config`](./packages/eslint-config) | Shared ESLint configurations                                      |

### Repo-level tooling

| Path                                                 | Purpose                                                          |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| [`docker-compose.yml`](./docker-compose.yml)         | Local dev stack (Postgres, Redis, Anvil) with opt-in app profile |
| [`.github/workflows`](./.github/workflows)           | CI pipelines (`ci.yml`, `docker.yml`)                            |
| [`.github/dependabot.yml`](./.github/dependabot.yml) | Weekly auto-PRs for npm, Go modules, and GitHub Actions          |

## Tech stack

| Layer           | Technology                                                               |
| --------------- | ------------------------------------------------------------------------ |
| Language        | TypeScript 5.7, Solidity 0.8.x, Go 1.25                                  |
| Smart contracts | Foundry, OpenZeppelin Contracts                                          |
| Backend HTTP    | NestJS 11 (Node 22)                                                      |
| Backend workers | NestJS standalone + BullMQ; Go for the indexer                           |
| Frontend        | Next.js 15 (App Router), React 19, Tailwind v4, shadcn/ui                |
| Wallet & chain  | viem 2.x, wagmi 2.x, Privy (merchant auth), Reown AppKit (payer connect) |
| Database        | PostgreSQL 16, Prisma 7, Redis 7                                         |
| Validation      | Zod 3                                                                    |
| Build           | Turborepo 2, pnpm 10, tsup                                               |
| Observability   | OpenTelemetry, Sentry, Pino                                              |
| Hosting         | Vercel (web), Render (api, indexer, scheduler, agent, Postgres, Redis)   |

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
                            │   agent    │  Read-only. Listens to Redis
                            │  (NestJS)  │  events, runs ERC-8004 identity
                            └────────────┘  + ERC-8183 escrow flows.
```

The contract is the source of truth for money. Postgres is a read-side projection of the chain. Webhooks are the merchant's view of the projection.

### Smart contract layer

Located in [`packages/contracts/src`](./packages/contracts/src). Built and tested with [Foundry](https://book.getfoundry.sh).

**Modules.**

| Module        | Contracts                                                        |
| ------------- | ---------------------------------------------------------------- |
| `core/`       | `StrimzRegistry`, `StrimzPayments`, `StrimzSubscriptions`        |
| `fees/`       | `FeeCollector`                                                   |
| `tokens/`     | `TokenWhitelist`                                                 |
| `access/`     | `StrimzAccessControl`, `Pausable`                                |
| `agent/`      | `StrimzAgentRegistry` (ERC-8004), `StrimzAgentEscrow` (ERC-8183) |
| `interfaces/` | One interface per public contract                                |

**Design rules.**

- **Registry-backed merchants.** Merchants are identified by an on-chain id. `StrimzRegistry` holds the merchant's payout address, fee bps, and active flag. Payments and subscriptions read from the registry, so payout addresses can rotate without redeploying.
- **Idempotent subscription charges.** Every charge call carries a `bytes32 chargeAttemptId`. The contract rejects reused ids. This kills the double-charge class of bugs that polling cron jobs are prone to.
- **Events as the canonical projection source.** Contracts emit rich events (`PaymentExecuted`, `SubscriptionCharged`, `FeeAccrued`, `RefundRecorded`). The indexer rebuilds Postgres from these events, so the database is reconstructable from chain history at any time.
- **Selective upgradeability.** The policy contracts (`StrimzRegistry`, `FeeCollector`, `TokenWhitelist`, `StrimzAgentRegistry`, `StrimzAgentEscrow`) are UUPS because policy changes. The value-moving contracts (`StrimzPayments` and `StrimzSubscriptions`) are deliberately immutable. A new version of either is a fresh deploy that the registry then points to.
- **Pull payments for fees.** Fees accrue to `FeeCollector`. The treasury withdraws on a schedule. This shrinks the reentrancy surface and isolates accounting.
- **Owner-pausable kill switch.** Every value-moving function respects `Pausable`. If something is wrong, all transfers halt at once.

### Backend services

Three Node services (NestJS) and one Go service. Each runs as its own process. A slow webhook delivery cannot block a payment session, and a stuck cron cannot block the API.

**`apps/api`. HTTP API.** Module-per-bounded-context layout. Examples: `merchants`, `api-keys`, `payment-sessions`, `subscriptions`, `refunds`, `webhooks`, `compliance`, `analytics`, `agents`. Common cross-cutting concerns (`ApiKeyGuard`, `JwtGuard`, `TierGuard`, `ZodValidationPipe`, `StrimzError` filter) live in `common/`. Side effects (Prisma, Redis, BullMQ, Resend, viem) live in `infra/` and are injected through interfaces. Controllers validate and delegate. Services hold the domain rules. Repositories own persistence. The API never reads from the chain directly. It reads from Postgres, which the indexer keeps current.

**`apps/indexer`. Chain projector (Go).** Subscribes to Arc events
through `go-ethereum`. For each event it parses to a domain event,
writes to Postgres (advancing a per-contract cursor), and publishes
to a Redis stream so the scheduler and agent can react in real
time. The indexer is in Go because the workload is bounded by I/O
concurrency and long-running connections, which Go handles cleanly.
Resumable on restart, idempotent on replay.

**`apps/scheduler`. Workers.** NestJS standalone app backed by BullMQ. Three queues:

- `subscription.due`. Cron-driven. Reads due subscriptions from Postgres, derives a deterministic `chargeAttemptId = keccak256(subscriptionId, periodEndAt)` per sub, and asks the relayer in `apps/api` to broadcast `batchCharge` on the contract.
- `webhook.deliver`. Exponential backoff (1m, 5m, 30m, 2h, 12h, five attempts), then dead-lettered with a merchant alert.
- `agent.action`. Drives the AutoPay Agent's scheduled actions: subscription recovery retries, daily cashflow digests, CCTP settle.

The scheduler does not hold any signing key. When a worker needs an
on-chain write, it calls into `apps/api`, which signs through its
KMS provider and broadcasts. This keeps the most sensitive secret
in exactly one process.

**`apps/agent`. The AutoPay Agent.** NestJS service that holds the agent's ERC-8004 identity, drives ERC-8183 escrow operations, and orchestrates recovery, routing, cashflow, and commerce flows. Reads the Redis event stream the indexer publishes and reacts within a bounded SLA. Configurable per merchant via `AgentMerchantConfig`. Holds no signing key.

### Frontend

`apps/web` is a single Next.js 15 App Router app that serves three distinct audiences:

- `(marketing)`. Public landing, pricing, docs.
- `(auth)`. Merchant sign-in and sign-up.
- `(dashboard)`. Authenticated merchant surface: overview, transactions, subscriptions, customers, refunds, webhooks, API keys, agent settings, storefront, invoices, treasury, billing, settings.
- `pay/[sessionId]` and `sub/[planId]`. Payer-facing hosted checkout, isolated so it can later be embedded in iframes without dashboard chrome leaking through.
- `invoice/[id]`. Public invoice page.

Server components are the default. Interactive leaves (wallet connect, charts, forms) are client components. Forms use React Hook Form with the same Zod schemas the API validates against, so client and server cannot disagree on shape. Server state is owned by TanStack Query. Client state is small and lives in component-local React state or thin Zustand slices.

Two wallet ecosystems coexist by design, each scoped to its own audience:

- **Privy.** Merchant identity. Email / Google / wallet login on `/signup` and `/login`, embedded wallet for the dashboard owner. Configured with Arc as `defaultChain` so the embedded wallet is created on Arc rather than Ethereum mainnet.
- **Reown AppKit.** Anonymous payer wallet connect on the public `/pay/[sessionId]` and `/sub/[planId]` checkout pages. Brings the long tail of WalletConnect-compatible wallets (MetaMask, Rainbow, Coinbase Wallet, Trust, etc.) without requiring the payer to have a Strimz account.

The two domains never share connector state. They live in different routes serving different actors. Both wrap the app in `apps/web/src/components/providers.tsx`, with Wagmi/AppKit hydrated via cookies in `apps/web/src/app/layout.tsx` to avoid SSR hydration mismatch on the initial paint.

### Payment session lifecycle

```
1. Merchant calls the SDK                strimz.paymentSessions.create({ amount, currency, ... })
2. SDK posts POST /v1/payment-sessions   apps/api validates, persists, returns { id, checkoutUrl }
3. Merchant redirects the payer          apps/web/pay/[sessionId]
4. Payer connects a wallet               viem + wagmi + Reown AppKit (any major wallet)
5. Payer signs one EIP-3009 message      single wallet prompt, no gas paid by the payer
6. Relayer (apps/api) broadcasts the tx  StrimzPayments.payWithAuthorization splits the fee atomically
7. Indexer ingests PaymentExecuted       writes Transaction, advances the cursor, publishes to Redis
8. Scheduler runs the webhook job        POSTs to the merchant URL, signed with HMAC-SHA256
9. Merchant verifies the signature       @strimz/sdk verifyWebhookSignature
```

Every step after (6) is asynchronous and idempotent. If any step fails, the chain remains the source of truth and the projection rebuilds.

### Subscription charging lifecycle

```
A. Merchant defines a SubscriptionPlan   (price, interval, currency, gracePeriod)
B. Customer subscribes                   (signs an EIP-2612 permit; relayer calls permitAndCreateSubscription)
C. Scheduler runs subscription.due cron  (every 15 min; selects subs where nextChargeAt <= now)
D. Worker derives chargeAttemptId        (keccak256(subscriptionId, periodEndAt); deterministic, replay-safe)
E. Relayer (apps/api) signs and broadcasts batchCharge(ids[], attemptIds[])
   ├─ Contract verifies each subscription is active and chargeAttemptId is unused
   ├─ For each: pulls funds, splits fee, emits SubscriptionCharged
   └─ Returns a per-id outcome (charged | insufficient | revoked)
F. Indexer ingests the events            (updates SubscriptionCharge status)
G. On insufficient funds:
   ├─ Worker schedules a retry inside the merchant's grace period
   ├─ AutoPay Agent emails the payer a low-balance reminder
   └─ If grace expires, the subscription flips to lapsed and the subscription.lapsed webhook fires
H. Webhook delivery follows the same retry path as one-shot payments
```

Two consequences of how the contract is structured:

1. A subscription is never double-charged for the same period. The contract's `chargeAttemptId` mapping rejects reuse.
2. A subscription cancelled on-chain between the cron tick and the broadcast is skipped. The contract rejects the call, and the worker records the outcome.

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
- Go 1.25 (only required to develop the indexer)

### First-time setup

```sh
git clone <repo-url> strimz
cd strimz
git submodule update --init --recursive       # Foundry deps live in packages/contracts/lib
pnpm install

# Optional — copy compose env template if you need to override defaults
cp .env.docker.example .env

# Boot local infra (Postgres, Redis, Anvil)
docker compose up -d

# Apply Prisma migrations against the compose Postgres
pnpm --filter @strimz/db db:migrate

# Run every app in watch mode via Turbo
pnpm dev
```

The default `docker compose up` brings up three infra services:

| Service    | Host port | Purpose                                               |
| ---------- | --------- | ----------------------------------------------------- |
| `postgres` | `5432`    | Source of read state for every Node app               |
| `redis`    | `6379`    | BullMQ queues, idempotency cache, rate-limit buckets  |
| `anvil`    | `8545`    | Local EVM devnet (chain id `31337`) for contract work |

For an end-to-end smoke test of the **build artifacts** (rare; mostly pre-deploy), the `full` profile also rebuilds and boots `api`, `scheduler`, `agent`, and `indexer` from their Dockerfiles:

```sh
docker compose --profile full up
```

Apps in the `full` profile reach Postgres / Redis / Anvil via compose service names; apps run from your shell via `pnpm dev` use `localhost`.

### Useful scripts

| Command                                      | Description                                            |
| -------------------------------------------- | ------------------------------------------------------ |
| `pnpm dev`                                   | Run all apps in watch mode                             |
| `pnpm build`                                 | Build everything via Turbo                             |
| `pnpm lint`                                  | Lint everything                                        |
| `pnpm typecheck`                             | Typecheck everything                                   |
| `pnpm test`                                  | Test everything                                        |
| `pnpm format`                                | Prettier write                                         |
| `pnpm format:check`                          | Prettier verify (CI runs this; same rules as `format`) |
| `pnpm changeset`                             | Create a changeset for an SDK release                  |
| `pnpm --filter @strimz/contracts forge:test` | Run Foundry tests                                      |
| `pnpm --filter @strimz/db db:migrate`        | Apply Prisma migrations                                |
| `pnpm --filter web dev`                      | Run only the web app                                   |

### Continuous integration

Three parallel jobs run on every PR via [`.github/workflows/ci.yml`](./.github/workflows/ci.yml):

| Job       | What it runs                                                                                                                       |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `node`    | `pnpm install` → `pnpm build` (turbo `^build`, generates the Prisma client first) → `format:check` → `lint` → `typecheck` → `test` |
| `go`      | `go vet`, `go build`, race-tested unit tests on `apps/indexer`                                                                     |
| `foundry` | `forge fmt --check`, `forge build --sizes`, `forge test -vvv`. Checks out submodules so `forge-std` and OpenZeppelin libs resolve. |

A separate [`docker.yml`](./.github/workflows/docker.yml) workflow builds every app's Dockerfile via a matrix, but only when a Dockerfile or `docker-compose.yml` actually changes. Otherwise it would be a slow tax on every unrelated PR.

[Dependabot](./.github/dependabot.yml) opens grouped weekly PRs for npm (`@nestjs/*`, `next + react`, lint/format tooling each in their own group), Go modules (`apps/indexer`), and GitHub Actions.

## Environment configuration

Each app has its own `.env.example` listing required and optional variables. Copy each one to `.env` for local use. Production values live in Render and Vercel, never in the repo. Recurring variables across apps:

| Variable                            | Used by                        | Purpose                                                                       |
| ----------------------------------- | ------------------------------ | ----------------------------------------------------------------------------- |
| `DATABASE_URL`                      | api, indexer, scheduler, agent | Postgres connection string                                                    |
| `REDIS_URL`                         | api, scheduler, agent          | Redis connection string                                                       |
| `ARC_RPC_URL`                       | api, indexer, scheduler, agent | Arc JSON-RPC endpoint                                                         |
| `ARC_CHAIN_ID`                      | all                            | Chain id (`5042002` testnet)                                                  |
| `STRIMZ_REGISTRY_ADDRESS`           | all                            | Deployed `StrimzRegistry` address                                             |
| `STRIMZ_WEBHOOK_SIGNING_SECRET`     | api, scheduler                 | HMAC secret for webhook signatures                                            |
| `WEBHOOK_SECRET_ENCRYPTION_KEY`     | api, scheduler                 | AES-256-GCM key for encrypting per-endpoint webhook secrets at rest           |
| `JWT_SECRET`                        | api                            | Merchant session JWT secret                                                   |
| `PRIVY_APP_ID` / `PRIVY_APP_SECRET` | web, api                       | Merchant auth (email + embedded wallet)                                       |
| `NEXT_PUBLIC_REOWN_PROJECT_ID`      | web                            | Reown AppKit project id for payer wallet connect on checkout                  |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`    | web                            | Cloudflare Turnstile site key for bot-protection on `/signup`                 |
| `TURNSTILE_SECRET_KEY`              | api                            | Cloudflare Turnstile secret for the server-side Siteverify call               |
| `RESEND_API_KEY`                    | api, scheduler                 | Transactional email — sending-scoped key, restricted to `mail.strimz.finance` |
| `RESEND_FROM_EMAIL`                 | scheduler                      | From header; defaults to `Strimz <noreply@mail.strimz.finance>`               |
| `RESEND_REPLY_TO`                   | scheduler                      | Reply-To header; defaults to the Strimz ops mailbox                           |
| `STRIMZ_ADMIN_ALERT_EMAIL`          | scheduler                      | Where gas-balance + ops alerts are sent                                       |
| `STRIMZ_DASHBOARD_URL`              | scheduler                      | CTA destination for merchant email links                                      |
| `SENTRY_DSN`                        | all                            | Error tracking (optional in dev)                                              |

## Project structure

```
strimz/
├── apps/
│   ├── web/                   Next.js 15. Dashboard, checkout, marketing.
│   ├── api/                   NestJS HTTP API           (Dockerfile)
│   ├── indexer/               Go chain projector        (Dockerfile)
│   ├── scheduler/             NestJS BullMQ workers     (Dockerfile)
│   └── agent/                 NestJS AutoPay Agent       (Dockerfile)
├── packages/
│   ├── contracts/             Foundry workspace
│   ├── sdk/                   @strimz/sdk
│   ├── sdk-react/             @strimz/sdk-react
│   ├── db/                    Prisma schema + client
│   ├── shared-types/          Zod schemas
│   ├── shared-config/         Chains, tokens, tiers
│   ├── shared-crypto/         HMAC, webhook verify
│   ├── ui/                    shadcn + Strimz brand
│   ├── tsconfig/              Base TS configs
│   └── eslint-config/         Base ESLint configs
├── .github/
│   ├── workflows/
│   │   ├── ci.yml             Parallel node / go / foundry jobs
│   │   └── docker.yml         Matrix Dockerfile build (paths-filtered)
│   └── dependabot.yml         Grouped weekly dependency PRs
├── docker-compose.yml         Local infra stack + opt-in `full` app profile
├── .env.docker.example        Compose env override template
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

## Deployment targets

| Surface          | Host                                      |
| ---------------- | ----------------------------------------- |
| `apps/web`       | Vercel                                    |
| `apps/api`       | Render (Web Service)                      |
| `apps/indexer`   | Render (Background Worker)                |
| `apps/scheduler` | Render (Background Worker)                |
| `apps/agent`     | Render (Background Worker)                |
| Postgres 16      | Render (Managed PostgreSQL)               |
| Redis 7          | Render (Managed Key Value)                |
| Smart contracts  | Arc testnet (`5042002`), then Arc mainnet |

### Post-deploy runbook

After a fresh contract deploy (or after rotating a hot key), the operator EOAs need their on-chain roles. The deployer EOA is cold and holds `DEFAULT_ADMIN_ROLE`; the API relayer needs `MERCHANT_REGISTRAR_ROLE` and the scheduler needs `CHARGER_ROLE`. Run:

```sh
cd packages/contracts
set -a && source .env && set +a    # exposes deployer key + addresses
./script/grant-operator-roles.sh   # MAINNET=1 for mainnet
```

The script is idempotent — it `hasRole`-checks before every `grantRole`, so a re-run after a key rotation only sends the grants that are genuinely missing. See [`packages/contracts/script/grant-operator-roles.sh`](./packages/contracts/script/grant-operator-roles.sh) for the env it expects.

### Operational safety nets

A handful of defence-in-depth mechanisms live across the data model and the scheduler. They're invisible during the happy path but worth knowing when reading logs:

- **Double-pay protection.** Three independent layers: the indexer stamps `PaymentSession.onchainTxHash` once a `PaymentSettled` event lands; the API's `alreadyPaidView` query short-circuits a second relay submission for the same session; the hosted-checkout page polls the session status before showing a sign prompt. Any one of the three would catch a duplicate; all three together make double-pay structurally impossible.
- **Double-enrolment protection.** `Subscription.enrolmentTxHash` is a unique column; the API's `alreadyEnrolledView` query rejects any second permit submission for the same `(planId, payerAddress)`. The merchant sees the same `Subscription` row, not two.
- **Stale charge-lock reclaim.** `Subscription.chargeLock` is held by the scheduler while a `batchCharge` is in-flight. The sweeper's `WHERE` clause reclaims any lock older than 10 minutes (configurable via `SUBSCRIPTION_CHARGE_LOCK_TTL_SECONDS`), so a scheduler crash mid-batch can't strand a subscription forever.
- **Callback URL allowlist.** `successUrl` and `cancelUrl` on a `PaymentSession` are validated against an http(s)-only schema before persistence. `javascript:`, `data:`, `file:` URLs are rejected at the API boundary — they never reach the merchant's redirect.
- **Idempotent onchain projection.** The indexer's `InsertSubscriptionChargeSkip` projection refuses to downgrade a `Subscription` from `active` → `at_risk` if a `succeeded` `SubscriptionCharge` already exists for the same period. Prevents a duplicate-skip event racing with a successful charge.

### Email notifications

Transactional and operational email is owned by the scheduler — one cron (`merchant-notifications`) polls four lanes (welcome, payment received, subscription started, subscription charged), one cron (`gas-balance-monitor`) watches the relayer + scheduler USDC balances with edge-triggered alerting. Both go through Resend on the verified `mail.strimz.finance` domain.

| Variable                           | Default                                | Purpose                                                                                       |
| ---------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`                   | _(unset — stub mode)_                  | Sending-scoped API key from resend.com. Empty value logs sends locally; set in prod.          |
| `RESEND_FROM_EMAIL`                | `Strimz <noreply@mail.strimz.finance>` | From header. Must live on the verified subdomain.                                             |
| `RESEND_REPLY_TO`                  | `strimztokenstream@gmail.com`          | Reply-To header; recipients hit Reply and land on the Strimz ops mailbox.                     |
| `STRIMZ_ADMIN_ALERT_EMAIL`         | _(required)_                           | Recipient for gas-balance + ops alerts. Distinct from `RESEND_FROM_EMAIL`.                    |
| `STRIMZ_DASHBOARD_URL`             | falls back to brand origin             | CTA destination for merchant email links. Set per env (localhost in dev, deploy URL in prod). |
| `GAS_BALANCE_CRON`                 | `0 */15 * * * *`                       | Schedule for the relayer/scheduler balance check.                                             |
| `GAS_BALANCE_THRESHOLD_USDC`       | `5`                                    | Alert fires when either EOA's USDC balance drops below this value.                            |
| `MERCHANT_NOTIFICATION_CRON`       | `*/30 * * * * *`                       | Schedule for the merchant-notifications cron.                                                 |
| `MERCHANT_NOTIFICATION_BATCH_SIZE` | `50`                                   | Per-tick cap for each notification lane.                                                      |

## Contributing

- Create a branch from `main`. Branch naming: `feat/<scope>`, `fix/<scope>`, `chore/<scope>`.
- Conventional commits: `feat(api): ...`, `fix(contracts): ...`, `chore(repo): ...`.
- Every SDK-touching PR ships a [changeset](https://github.com/changesets/changesets).
- `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` must pass. These are the same checks CI runs (see [Continuous integration](#continuous-integration)).
- Contract changes require Foundry tests, including invariant tests for value-moving functions.
- The root `package.json` carries a `pnpm.overrides` block pinning `@wagmi/connectors` to `^5.x`. Don't remove it without verifying. `@reown/appkit-adapter-wagmi`'s open-ended optional peer otherwise lets pnpm resolve the broken `@wagmi/connectors@8.x` line, which breaks the web app's build. The `_overridesNote` field in that file carries the full reason.

## License

[MIT](./LICENSE) © 2026 Strimz.
