# `@strimz/scheduler`

NestJS background-worker process. Owns cron jobs and the webhook
delivery queue. Does not hold any signing key. When a tick needs an
on-chain write, the scheduler calls into `apps/api`, which signs
through its KMS provider and broadcasts.

## Responsibilities

| Surface                | Source                                       | Effect                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Webhook delivery       | `strimz.webhook.delivery` queue              | Sign with HMAC-SHA256 (`Strimz-Signature: t=<unix>,v1=<hex>`), POST to merchant URL with timeout, retry with exponential backoff (1m → 5m → 30m → 2h → 12h, default 5 attempts), update `WebhookDelivery` row per attempt. On permanent failure: email merchant; on 5+ permanent failures within 24h: auto-disable the endpoint and email a separate notice. |
| Subscription charges   | Cron sweep + `strimz.subscription.due` queue | Atomically lock due `Subscription` rows, enqueue per sub, worker derives deterministic `chargeAttemptId`, calls `batchCharge`, releases lock. Sweeper `WHERE` clause reclaims any `chargeLock` older than 10 min so a scheduler crash mid-batch can't strand a sub.                                                                                          |
| Subscription lapsed    | Cron                                         | Flip `at_risk → lapsed` once `currentPeriodEndAt + gracePeriodHours` has elapsed, fire `subscription.lapsed` webhook                                                                                                                                                                                                                                         |
| Agent escrow ops       | `strimz.agent.action` queue                  | Subscription cancel + full job lifecycle (create / release / dispute / cancel)                                                                                                                                                                                                                                                                               |
| Invoice overdue        | Cron                                         | Flip past-due `Invoice` rows to `overdue`, fire `invoice.overdue` webhook                                                                                                                                                                                                                                                                                    |
| Merchant notifications | Cron                                         | Polls four `*NotifiedAt IS NULL` lanes — `Merchant.welcomeNotifiedAt`, `PaymentSession`, `Subscription`, `SubscriptionCharge` — renders the matching React Email template, sends via Resend, stamps the column. One-shot per row.                                                                                                                            |
| Gas balance monitor    | Cron                                         | Reads the relayer + scheduler USDC balances on Arc. Edge-triggered alert to `STRIMZ_ADMIN_ALERT_EMAIL` on the transition below `GAS_BALANCE_THRESHOLD_USDC`. 24h Redis dedup flag prevents repeat alerts; the flag self-clears once balance recovers.                                                                                                        |

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
    email/                   Resend client + default From/Reply-To; stub mode when RESEND_API_KEY is unset
  workers/
    webhook-delivery         POST + retry + DB update state machine
    subscription-due         derive chargeAttemptId, batchCharge, release lock
    agent-action             discriminated-union dispatch over agent op types
  crons/
    subscription-sweeper     SELECT … FOR UPDATE SKIP LOCKED; multi-instance safe
    subscription-lapsed      flip at_risk → lapsed after grace; fire subscription.lapsed
    invoice-overdue          flip + fire invoice.overdue webhook
    merchant-notifications   four-lane email cron; one-shot stamps on the source row
    gas-balance-monitor      relayer + scheduler USDC watchdog; edge-triggered alerts
```

## Admin endpoints (non-prod only)

`AdminController` exposes manual triggers so dev + CI can step each cron deterministically instead of waiting for the schedule. The handler refuses to dispatch when `NODE_ENV === 'production'` — the route 404s rather than 403 so it never advertises its existence to unauthorised callers.

| Endpoint                                 | Effect                                         |
| ---------------------------------------- | ---------------------------------------------- |
| `POST /admin/sweep-now`                  | Run the subscription sweeper once.             |
| `POST /admin/run/gas-balance-monitor`    | Check both EOA balances; alert if newly below. |
| `POST /admin/run/merchant-notifications` | Drain all four notification lanes once.        |

## Email sending

Transactional email goes through Resend on `mail.strimz.finance`. `EmailService` is a thin wrapper:

- **From** is fixed to `RESEND_FROM_EMAIL` — callers cannot override; Resend rejects any from-address outside the verified subdomain.
- **Reply-To** defaults to `RESEND_REPLY_TO` (the Strimz support mailbox) so when a merchant hits Reply on a payment confirmation, the response lands in a human inbox rather than bouncing off `noreply@`.
- **Stub mode** activates when `RESEND_API_KEY` is unset. Sends are logged with the `to=` and `subject=` and return `{queued: false}`. The merchant-notifications cron still stamps `*NotifiedAt` in stub mode to avoid retry churn in dev — the alternative would be every-tick repeat sends behind constant churn that would mask real Resend errors later.

Templates ship in [`@strimz/email-templates`](../../packages/email-templates) and are rendered to HTML at send time. Brand display (footer "Sent by Strimz — strimz.finance") is decoupled from operational URLs (CTAs, logo) so the apex can read on emails before it's actually pointed at the deployment.

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
