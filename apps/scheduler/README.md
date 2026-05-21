# `@strimz/scheduler`

NestJS background-worker process. Owns cron jobs and the webhook
delivery queue. Does not hold any signing key. When a tick needs an
on-chain write, the scheduler calls into `apps/api`, which signs
through its KMS provider and broadcasts.

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

The sweeper uses Postgres
`UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)` to acquire
`chargeLock` atomically. Two scheduler replicas running concurrently
never see the same subscription as available. Whichever process
wins the row-level lock keeps the batch; the other picks up the
next one.

The webhook-delivery worker is also multi-instance safe. BullMQ
delivers each job to exactly one worker, and the worker no-ops
early on any `WebhookDelivery.status` that's already terminal.

## Running

```bash
pnpm --filter @strimz/scheduler dev      # local
pnpm --filter @strimz/scheduler test     # 10 unit tests
pnpm --filter @strimz/scheduler test:e2e # 21 e2e tests (testcontainers Postgres + Redis)
```

## Talking to the relayer

The scheduler does not hold a signing key. When a worker needs an
on-chain write (subscription charge batch, on-chain cancel, agent
escrow op, CCTP settle), it posts an internal request to
`apps/api`. The API loads its KMS-backed key, signs, broadcasts,
and writes the resulting `TxRequest` row. The scheduler reads back
the receipt and updates its own state.

The on-chain operations the relayer signs on the scheduler's behalf:

- `StrimzSubscriptions.cancel(uint256)`
- `StrimzSubscriptions.batchCharge(uint256[], bytes32[])`
- `StrimzAgentEscrow.{createJob, approveAndRelease, dispute, cancelJob}(...)`
- `MessageTransmitter.receiveMessage(...)` for CCTP settle

Function ABIs for these calls live in `src/infra/chain/abis.ts`.
Any new on-chain operation goes through that file.

## Webhook signing secret cache

The API creates a webhook endpoint by generating a 32-byte secret.
Postgres stores `sha256(secret)` as the lookup index plus an
AES-256-GCM ciphertext of the plaintext. On boot the scheduler
decrypts every ciphertext into Redis under
`webhook:secret:<endpointId>` for the delivery worker to read on
the hot path. Redis is a cache; the source of truth is Postgres.
If Redis is flushed, the scheduler re-warms the cache on the next
boot and webhook delivery resumes with no merchant action. Rotation
is an atomic `set` against the cache plus a new ciphertext write.
