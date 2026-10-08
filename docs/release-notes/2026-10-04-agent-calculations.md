---
date: 2026-10-04
feature: Agent reports keep USDC and EURC apart and compute the right numbers; /readyz checks Postgres and Redis
scope: fix
scenario-impact: needs_automation
---

# Agent: report and anomaly calculations

The AutoPay Agent's reports no longer add USDC and EURC together, and count live-mode
revenue only. The commerce summary, revenue anomaly alert and pricing forecast now compute
what they say they compute. The agent's `/readyz` reports whether it can reach Postgres
and Redis, and the agent no longer requires `ARC_RPC_URL`.

Closes #155. ADR: [ADR-2026-10-04-agent-calculations](../adr/ADR-2026-10-04-agent-calculations.md)
([plain-English version](../adr/ADR-2026-10-04-agent-calculations-for-dummies.md)),
accepted 2026-10-04 and amended 2026-10-06.

## What was wrong

- **Currencies added together.** The daily digest, anomaly alert, yield suggestion,
  commerce summary and pricing report added USDC and EURC amounts and labelled the result
  USDC or `$`. They also counted test-mode transactions, subscriptions and refunds, and the
  digest, anomaly and forecast counted refund transactions as revenue.
- **Commerce summary.** The total spend, job count and cap utilisation were added up from
  the five largest vendors only. A sixth vendor's spend was missing from the total.
- **Anomaly baseline.** The hour being checked was part of its own 30-day baseline, which
  pulled the mean towards it and hid real drops. Hours with no revenue were left out of
  the baseline instead of counting as zero, so a merchant who sells every other day was
  alerted on every quiet day. Two ticks for the same hour sent two alerts.
- **Pricing forecast.** The 30/60/90-day forecast multiplied the last projected day by the
  number of days instead of adding up each projected day, and treated the days that had
  revenue as consecutive days.
- **Cron schedules.** Each `@Cron` decorator read `process.env` when its file was
  imported, with its own copy of the default, instead of the validated configuration.
- **`/readyz`** returned `ready` without checking anything.
- **`ARC_RPC_URL`** was required at boot although nothing in the agent reads it.

## What shipped

- **Per currency everywhere.** Aggregates are grouped by currency and folded with
  `toCurrencyAmounts` (`apps/agent/src/common/money/currency-amounts.ts`, a copy of the
  API helper), which throws on an unknown or repeated currency.
  - Digest: one revenue, fees and net block per currency with activity (a USDC block of
    zeros when there is none). Metadata `revenue`, `fees`, `net` are replaced by
    `revenueUsdc`, `revenueEurc`, `feesUsdc`, `feesEurc`, `netUsdc`, `netEurc`.
  - Anomaly: each currency is scored on its own baseline; a drop in either flags. The
    email names the currency; activity and `AuditLog` metadata gain `currency`; dedupe is
    per merchant, hour and currency, so a merchant can get two alerts for one hour.
  - Yield: only the USDC balance is compared with the USD-cents reserve. The email shows
    the EURC balance on its own line; metadata gains `eurcBalance` (base units).
  - Commerce: spend per currency, top five vendors per currency, amounts labelled with
    their currency. Metadata `totalSpendCents` is replaced by `spendUsdc` and `spendEurc`;
    `capUtilisationPct` counts USDC only.
  - Pricing: MRR and the forecast per currency, shown for each currency with data; churn
    stays one rate.
- **Live mode and no refunds.** Every aggregate over `Transaction`, `Refund` and
  `Subscription` filters `mode = 'live'`; digest, anomaly and forecast also exclude
  `kind = 'refund'`. Commerce is not filtered by mode, because `AgentJob` has no `mode`.
- Every metadata key stays flat, so activity rows still parse with the published
  `agentActivityLogSchema` and `@strimz/sdk`. No published package changes. The
  `GET /v1/agents/activity` docs list the new keys.
- Commerce totals come from their own query over every approved and completed job; the
  email still lists the top five vendors.
- The anomaly baseline is the same hour on each of the 30 days before the checked hour,
  counted from the merchant's first confirmed transaction, with hours without revenue as
  zero. The 7-sample minimum is unchanged. An hour already flagged for a merchant is not
  flagged again (keyed on the `hour` already stored in the activity metadata).
- The forecast regresses over calendar days from the first revenue day in the last 90
  days to yesterday (UTC), counting empty days as zero, and each horizon is the sum of the
  projected days, each floored at zero. This is the method `GET /v1/stats/forecast` uses.
- Crons are registered at application bootstrap from `TypedConfigService`, under the same
  names (`recovery-tick`, `cashflow-digest`, `cashflow-anomaly`, `cashflow-yield`,
  `commerce-monthly`, `pricing-monthly`). `cron@3.5.0` (the version `@nestjs/schedule`
  already uses) is now a direct dependency of `@strimz/agent`.
- `GET /readyz` runs `SELECT 1` and a Redis `PING`, each with a 2 second limit.
  `200 {"status":"ready","checks":{"database":"ok","redis":"ok"}}` when both answer,
  `503 {"status":"unavailable","checks":{...}}` naming the failed check otherwise.
  `/healthz` is unchanged.
- `ARC_RPC_URL` removed from the agent env schema, `apps/agent/.env.example`, the agent
  service in `docker-compose.yml` and the self-hosting docs. It stays in
  `infra/lightsail/env.example`, which is shared with the API, scheduler and indexer.

## Deploy

No migration. Activity rows written before this release keep the old keys (`revenue`,
`fees`, `net`, `totalSpendCents`); readers of `GET /v1/agents/activity` need to handle
both. Readiness probes that hit the agent's `/readyz` can now receive `503`
while Postgres or Redis is down. Existing `ARC_RPC_URL` values in agent environments are
ignored and can be removed.

## Not changed

The yield reserve and the commerce spend cap stay in US dollar cents and count USDC only;
EURC is reported, never converted. Commerce spend includes jobs made in test mode.
