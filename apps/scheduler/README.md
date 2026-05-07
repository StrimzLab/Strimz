# `@strimz/scheduler`

NestJS background-worker process. The **only** Strimz app that holds a service-wallet signing key — every on-chain write goes through here.

## Responsibilities

| Surface              | Source                                       | Effect                                                                                                                                                                                                                                                                                                                                                       |
| -------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Webhook delivery     | `strimz.webhook.delivery` queue              | Sign with HMAC-SHA256 (`Strimz-Signature: t=<unix>,v1=<hex>`), POST to merchant URL with timeout, retry with exponential backoff (1m → 5m → 30m → 2h → 12h, default 5 attempts), update `WebhookDelivery` row per attempt. On permanent failure: email merchant; on 5+ permanent failures within 24h: auto-disable the endpoint and email a separate notice. |
| Subscription charges | Cron sweep + `strimz.subscription.due` queue | Atomically lock due `Subscription` rows, enqueue per sub, worker derives deterministic `chargeAttemptId`, calls `batchCharge`, releases lock                                                                                                                                                                                                                 |
| Subscription lapsed  | Cron                                         | Flip `at_risk → lapsed` once `currentPeriodEndAt + gracePeriodHours` has elapsed, fire `subscription.lapsed` webhook                                                                                                                                                                                                                                         |
| Agent escrow ops     | `strimz.agent.action` queue                  | Subscription cancel + full job lifecycle (create / release / dispute / cancel)                                                                                                                                                                                                                                                                               |
| Invoice overdue      | Cron                                         | Flip past-due `Invoice` rows to `overdue`, fire `invoice.overdue` webhook                                                                                                                                                                                                                                                                                    |

## Architecture

```
src/
  main.ts                    Fastify bootstrap, /healthz only
  config/                    Zod-validated env (chain RPC, wallet key, retries)
  infra/
    prisma/  redis/          composition pattern, shared with apps/api
    chain/                   viem public + wallet clients, function ABIs
    queue/                   @nestjs/bullmq + Zod payload schemas
    webhook-signing/         HMAC builder + Redis-backed plaintext-secret cache
    email/                   Resend (failure notifications)
  workers/
    webhook-delivery         POST + retry + DB update state machine
    subscription-due         derive chargeAttemptId, batchCharge, release lock
    agent-action             discriminated-union dispatch over agent op types
  crons/
    subscription-sweeper     SELECT … FOR UPDATE SKIP LOCKED; multi-instance safe
    subscription-lapsed      flip at_risk → lapsed after grace; fire subscription.lapsed
    invoice-overdue          flip + fire invoice.overdue webhook
```

## Multi-instance safety

The sweeper uses Postgres `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)` to acquire `chargeLock` atomically. Two scheduler replicas running concurrently never see the same subscription as available — whichever process the row-level lock falls to wins; the other transparently picks up the next batch.

The webhook-delivery worker is also multi-instance safe: BullMQ ensures each job is delivered to exactly one worker, and we no-op early on already-terminal `WebhookDelivery.status`.

## Running

```bash
pnpm --filter @strimz/scheduler dev      # local
pnpm --filter @strimz/scheduler test     # 10 unit tests
pnpm --filter @strimz/scheduler test:e2e # 21 e2e tests (testcontainers Postgres + Redis)
```

## Service-wallet key

The scheduler loads `SCHEDULER_PRIVATE_KEY` once at boot and keeps it in-process. **No other Strimz process may hold this key.** In production it comes from a secret manager (Render env, mounted from a vault). Local development uses any 32-byte hex.

The key signs every write to:

- `StrimzSubscriptions.cancel(uint256)`
- `StrimzSubscriptions.batchCharge(uint256[], bytes32[])`
- `StrimzAgentEscrow.{createJob, approveAndRelease, dispute, cancelJob}(...)`

These are the only function ABIs hand-curated in `src/infra/chain/abis.ts`. Any new on-chain operation goes through that file.

## Webhook signing secret cache

When the API creates a webhook endpoint it generates a 32-byte secret, stores `sha256(secret)` in Postgres for the lookup index, and writes the plaintext to Redis under `webhook:secret:<endpointId>` for the scheduler to read. Postgres dumps are the single most common sensitive-data leak vector; an in-memory store scoped separately to the same network keeps the blast radius small. Rotation is an atomic `set`.
