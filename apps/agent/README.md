# `@strimz/agent`

Strimz AutoPay Agent. Read-only background process that runs the merchant-configured capabilities. Never holds a signing key — anything that needs to sign on-chain is enqueued for the scheduler.

## Capabilities

| Capability             | Cadence             | Effect                                                                                                                                                                                                                                                                                                                                    |
| ---------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `recovery`             | Hourly              | For each `at_risk` Subscription, sends the merchant-configured notification email to the customer per the configured strategy (`once` / `twice` / `until_grace_ends`). Dedup via `AgentActivityLog`. Records `recovery_abandoned` when the customer has no email.                                                                         |
| `cashflow.digest`      | Daily 9am UTC       | Aggregates yesterday's confirmed `Transaction` revenue/fees/net/count/unique-customers and emails the merchant a summary. Idempotent per UTC day.                                                                                                                                                                                         |
| `cashflow.anomaly`     | Hourly              | Compares the last completed clock-hour's revenue against the trailing-30d hourly baseline (mean/stddev for the same hour-of-day). Flags drops only — fires email + `AuditLog` when below `nσ` (n derived from `cashflowAnomalySensitivity`). Skips merchants with <7 prior data points.                                                   |
| `cashflow.yield`       | Daily 9:30am UTC    | Computes running net balance vs `cashflowMinimumLiquidReserveCents`. When `cashflowAutoConvertToYield=true` and there's a surplus, emails a recommendation. Records `cashflow_yield_converted` with `outcome=pending` until the merchant confirms in-dashboard.                                                                           |
| `commerce`             | First of each month | Aggregates last month's approved/completed `AgentJob` rows by vendor, flags proposed (awaiting-approval) jobs, computes spend cap utilisation, emails the merchant.                                                                                                                                                                       |
| `pricing_intelligence` | First of each month | Computes MRR (interval-normalised), 12-month average churn, and 90-day linear-regression forecast (next 30/60/90 days), emails the merchant.                                                                                                                                                                                              |
| `routing`              | Queue-driven        | Consumes `strimz.routing.cctp.bridge`. Polls Circle's CCTP V2 attestation API for the source-chain burn tx; once `complete`, enqueues `routing.cctp.settle` onto the scheduler's `agent.action` queue. The scheduler signs `MessageTransmitter.receiveMessage(message, attestation)` on Arc. Both transitions land in `AgentActivityLog`. |
| `identity`             | Config-respecting   | Capability flag the dashboard checks before exposing business-info verification flows. The agent process itself takes no automation here.                                                                                                                                                                                                 |

## Architecture

```
src/
  main.ts                          NestJS+Fastify, /healthz
  config/                          Zod env (cron schedules, anomaly thresholds, Circle API)
  infra/
    prisma/                        Prisma client (composition pattern)
    email/                         Resend (logs-only when API key absent)
    activity-log/                  ActivityLogService — single insertion point
                                   for AgentActivityLog rows; typed
                                   capability/actionType/outcome enums
    queue/                         BullMQ wiring + Zod payload schemas
    circle-attestation/            CCTP V2 attestation API client
  capabilities/
    recovery/                      hourly cron + per-strategy state machine
    cashflow/
      digest.service.ts            daily summary
      anomaly.service.ts           SQL-driven z-score over hour-of-day window
      yield-recommendation.service.ts surplus → recommendation email
    commerce/                      monthly vendor + spend report
    pricing/                       monthly MRR/churn/forecast email
    routing/                       BullMQ worker for CCTP bridge attestation
  common/health/                   /healthz, /readyz
test/
  unit/                            CircleAttestationService request/parse
  e2e/                             23 cases against testcontainers Postgres + Redis
```

## What the agent doesn't do (by design)

- **No signing.** The agent holds no private key. Any on-chain action — yield deposit, CCTP settle — is enqueued for the scheduler to sign and broadcast.
- **No autonomous fund movement.** Yield recommendation surfaces a suggestion; the merchant explicitly approves before any tx is constructed.
- **No transition writes for state owned elsewhere.** The agent doesn't flip `Subscription.status` (that's owned by the indexer + scheduler-lapsed cron); it only reads state and writes `AgentActivityLog` / `AuditLog`.

## Routing CCTP V2

```
apps/web                    → enqueue strimz.routing.cctp.bridge
                              { merchantId, sourceDomainId, sourceTxHash, ref? }
agent.bridge.worker         → record routing_bridge_initiated (first attempt only)
                            → poll Circle iris-api.circle.com for attestation
                            → re-enqueue self with delay until status=complete
                            → enqueue scheduler agent.action(type=routing.cctp.settle)
                            → record routing_payment_completed
scheduler.agent-action      → MessageTransmitter.receiveMessage(message, attestation) on Arc
indexer                     → projects the resulting on-chain receipt event
```

The Circle attestation client lives in `infra/circle-attestation/`. Default base URL is the Circle sandbox (`iris-api-sandbox.circle.com`); mainnet override is `iris-api.circle.com`. `CIRCLE_API_KEY` is optional (only needed for higher rate-limit tiers).

## Running

```bash
pnpm --filter @strimz/agent dev          # local
pnpm --filter @strimz/agent test         # 4 unit tests (Circle API client)
pnpm --filter @strimz/agent test:e2e     # 23 e2e (testcontainers Postgres + Redis)
```

## Configuration

See `.env.example`. Cron schedules are env-driven so a test deployment can fire them on a faster cadence. The merchant's per-capability config lives in the `AgentMerchantConfig` model — the agent reads it on every tick (no in-process cache; merchants editing config in the dashboard see effects on the next tick).
