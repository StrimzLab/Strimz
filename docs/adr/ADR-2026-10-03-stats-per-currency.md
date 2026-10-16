# ADR: Server-side dashboard aggregates and per-currency analytics

- **Status:** Accepted 2026-10-03
- **Date:** 2026-10-03
- **Scope:** `apps/api` (`analytics` and `admin` modules), `packages/shared-types` (new
  `analytics.ts`, minor bump), `packages/db` (one index migration), `apps/web` (dashboard
  home, analytics, payment sessions, invoices, refunds, subscriptions, customers, admin
  overview, admin analytics, admin merchant drilldown). No contract, indexer, scheduler,
  queue payload or webhook payload change. `@strimz/sdk` has no stats resource today and
  gains none in this change (decision D7).

## Context

Issue #150. PR #195 made every money card on the dashboard per-currency, but the cards
are still computed in the browser and the analytics endpoints still add EURC to USDC.

**KPI cards computed from loaded rows.** Each page loads its list 100 rows at a time and
derives the cards from what has loaded so far. Since #195 they say "loaded only" when
more rows exist, which is honest but not correct.

| Page             | Card                                                    | Computed today from                                                       | File                                               |
| ---------------- | ------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------- |
| Home             | 7-day volume, 30-day volume chart and total             | first 100 payment sessions, `status = confirmed`, windowed on `updatedAt` | `apps/web/src/app/(dashboard)/app/page.tsx:58-106` |
| Home             | Open invoices                                           | first 100 invoices, `sent` or `overdue`, shown as `N+`                    | same file, `:74,:131-140`                          |
| Payment sessions | Total sessions, Confirmed amount, In-flight, Conversion | loaded sessions                                                           | `payment-sessions/page.tsx:80-97,281-287`          |
| Invoices         | Outstanding, Paid (30d), Overdue                        | loaded invoices                                                           | `invoices/page.tsx:62-81,259-290`                  |
| Refunds          | Completed amount, Awaiting signature, Failed            | loaded refunds                                                            | `refunds/page.tsx:77-87,358-374`                   |
| Subscriptions    | active, at risk, trialing, lapsed counts                | loaded subscriptions                                                      | `subscriptions/page.tsx:74-77,247-264`             |
| Customers        | Total customers                                         | loaded customers                                                          | `customers/page.tsx:83-92,249-253`                 |

The home volume card also has two semantic problems: it uses the session's `updatedAt` as
the payment time, and it ignores subscription charges because it reads sessions, not
transactions.

**Endpoints that add currencies together.** All amounts are `varchar` base-unit strings
with a sibling `currency` column (`PaymentCurrency`: `USDC`, `EURC`, both 6 decimals).

| Endpoint                                | What it does                                                                        | File                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `GET /v1/stats/mrr`                     | loops active subscriptions into one `bigint`, ignoring `currency`                   | `apps/api/src/modules/analytics/analytics.service.ts:86-101` |
| `GET /v1/stats/ltv`                     | `sum(amount)` grouped by customer only; ranks USDC and EURC spend together          | `analytics.service.ts:106-129`                               |
| `GET /v1/stats/forecast`                | `sum(netAmount)` grouped by day only, then one regression                           | `analytics.service.ts:137-167`                               |
| `GET /v1/admin/overview`                | lifetime volume, lifetime fees, 30-day volume and MRR, each one sum named `...Usdc` | `apps/api/src/modules/admin/admin.service.ts:68-137`         |
| `GET /v1/admin/merchants/:id`           | `lifetimeVolumeUsdc`, `last30dVolumeUsdc`                                           | `admin.service.ts:203-233`                                   |
| `GET /v1/admin/analytics/volume`        | daily `volume` and `fees` across currencies                                         | `admin.service.ts:299-326`                                   |
| `GET /v1/admin/analytics/top-merchants` | ranks by `sum(amount)` across currencies, `volumeUsdc`                              | `admin.service.ts:351-383`                                   |

The web formats every one of these as USDC: home MRR (`page.tsx:115`), analytics MRR,
forecast and LTV rows (`analytics/page.tsx:68,99,197,222-224`), admin overview, admin
analytics and the merchant drilldown (`(admin)/admin/page.tsx:69-87,193`,
`(admin)/admin/analytics/page.tsx:52-60,160`, `(admin)/admin/merchants/[id]/page.tsx:94-98`).
The admin volume chart divides the mixed sum by 10^6 (`(admin)/admin/page.tsx:45`,
`(admin)/admin/analytics/page.tsx:34-35`).

**Other defects found on the same paths.**

- The admin queries have no `mode` filter, so test-mode volume, fees and MRR are added to
  live figures (`admin.service.ts:84-104,211-220,303-312,359-371`).
- The indexer never writes `Transaction.customerId` (`apps/indexer/internal/store/projections.go:189,547`
  insert no customer), so `/v1/stats/ltv` returns an empty list for real traffic. The
  existing e2e test passes only because it seeds the column directly.
- `/v1/stats/ltv` reads `cursor` and ignores it; it always returns `hasMore: false`.
- `/v1/stats/forecast` returns `last90DayRevenue: "0"` when fewer than 7 days have revenue,
  even if there was revenue. Its regression x axis is the index of days that had revenue,
  not calendar days, so gaps compress time and inflate the slope.
- The response types are hand-written in `apps/web/src/lib/merchant-api/resources/analytics.ts`
  and `apps/web/src/lib/admin-api/types.ts`; nothing in `@strimz/shared-types` describes them.
- Out of scope, recorded for a follow-up issue: the agent service adds currencies together
  in `apps/agent/src/capabilities/cashflow/{anomaly,digest,yield-recommendation}.service.ts`,
  `commerce/commerce.service.ts` and `pricing/pricing.service.ts`.

**Constraints.** API key scopes are fail-closed since ADR-2026-10-03-api-key-scope-enforcement:
every merchant route must declare `@RequireScopes(...)` or `@SessionOnly()`, enforced by
`test/e2e/route-access-declared.e2e.test.ts`. The existing stats routes use
`analytics_read`, a scope added on 2026-10-03; before that any API key could read
`/v1/stats/*`. Strimz has not launched on mainnet.

## Decision

1. **Shared money shape.** `@strimz/shared-types` gains `analytics.ts` with
   `currencyAmountsSchema = z.object({ USDC: tokenAmountSchema, EURC: tokenAmountSchema })`,
   built from `paymentCurrencySchema` so a new currency is a compile error at every
   producer. Every supported currency is always present; an empty currency is `"0"`.
   Amounts are base-unit decimal strings, as everywhere else in the API. Every response
   below is a zod schema in that file, exported with its inferred type, and the API
   validates its own output against it in the e2e tests.
2. **SQL never sums across currencies.** Every money aggregate is
   `sum(x::numeric)::text ... GROUP BY currency` (no `::bigint`, so no overflow and no
   float). The service folds rows into `CurrencyAmounts` with one helper,
   `toCurrencyAmounts(rows)`, which starts from all currencies at `"0"` and rejects an
   unknown currency loudly. No TypeScript code adds two amounts of different currencies.
3. **`GET /v1/stats/summary`**, `@RequireScopes('analytics_read')`, scoped to the caller's
   merchant and mode, no query parameters. Each section is one SQL statement, all run in
   parallel:

   ```ts
   type CurrencyAmounts = { USDC: string; EURC: string }
   type Money = { count: number; amount: CurrencyAmounts }
   type VolumeWindow = {
     count: number
     gross: CurrencyAmounts
     fees: CurrencyAmounts
     net: CurrencyAmounts
   }
   type StatsSummary = {
     mode: 'test' | 'live'
     generatedAt: string
     volume: { last7d: VolumeWindow; last30d: VolumeWindow; allTime: VolumeWindow }
     paymentSessions: {
       total: number
       byStatus: Record<PaymentSessionStatus, number>
       confirmed: Money
     }
     invoices: {
       byStatus: Record<InvoiceStatus, number>
       outstanding: Money
       overdue: Money
       paidLast30d: Money
     }
     refunds: { byStatus: Record<RefundStatus, number>; completed: Money }
     subscriptions: { total: number; byStatus: Record<SubscriptionStatus, number> }
     customers: { total: number }
   }
   ```

   - `volume` reads `Transaction` with `status = 'confirmed'` and `kind <> 'refund'`,
     windowed on `blockTimestamp` (rolling 7 and 30 days from `now()`). It includes
     subscription charges.
   - `paymentSessions.confirmed` sums `PaymentSession.amount` for `confirmed` sessions.
   - `invoices.outstanding` is `sent` plus `overdue` on `total`; `paidLast30d` is `paid`
     with `paidAt` in the last 30 days.
   - `refunds.completed` sums `Refund.amount` for `completed`.
   - Every `byStatus` lists every enum value, zero included.
   - `customers.total` counts the merchant's customers; `Customer` has no `mode` column,
     matching the customers list.

4. **`GET /v1/stats/volume?from&to`**, `analytics_read`, for the home chart. `from` and
   `to` are ISO timestamps validated with zod, defaulting to the last 30 days, at most
   366 days apart. Response `{ from, to, data: { day, currency, count, gross, fees, net }[] }`,
   one row per day and currency that has volume, ordered by day then USDC before EURC.
   The web fills empty days.
5. **`GET /v1/stats/mrr` becomes `{ mrr: CurrencyAmounts, activeSubscribers: number }`.**
   Normalisation per interval is unchanged, applied per row in `bigint` and summed per
   currency. Only `active` subscriptions count, as today (decision D4).
6. **`GET /v1/stats/ltv?currency=USDC|EURC&limit&cursor`**. `currency` is required; a
   missing or unknown value is `400 invalid_request`. Ranking needs one unit; there is no
   exchange rate in Strimz and this change does not add one. Response
   `{ currency, data: { customerId, totalSpend, transactionCount }[], nextCursor, hasMore }`.
   Spend is gross confirmed inbound transactions in that currency. The customer is
   `COALESCE(t."customerId", ps."customerId", s."customerId")` through the transaction's
   session or subscription, so real indexer rows are attributed. The cursor is keyset on
   `(totalSpend DESC, customerId ASC)`, encoded opaque, and `hasMore` is real.
7. **`GET /v1/stats/forecast` becomes `{ byCurrency: { USDC: Forecast, EURC: Forecast } }`**
   with `Forecast = { confidence, last90DayRevenue, next30, next60, next90 }`. Each
   currency is regressed on its own daily net revenue over calendar days (empty days are
   zero), and `nextN` is the sum of the projected daily values over the next N days,
   floored at zero. `last90DayRevenue` is the real sum in every case. Fewer than 7 days
   with revenue in a currency gives `confidence: 'low'` and zero projections for that
   currency. Thresholds (7, 30, 60 days) are unchanged.
8. **Admin figures per currency and per mode.** Every admin money endpoint takes
   `mode=live|test`, default `live`, validated with zod, and echoes `mode` in the response.
   - `/v1/admin/overview`: `volume: { lifetime, lifetimeFees, last30d: CurrencyAmounts, confirmedSessions }`,
     `subscriptions: { active, mrr: CurrencyAmounts }`, plus `mode`. Counts are filtered by
     the same mode.
   - `/v1/admin/merchants/:id`: `stats: { confirmedPayments, activeSubscriptions, lifetimeVolume, last30dVolume }`.
   - `/v1/admin/analytics/volume`: rows `{ day, currency, volume, fees, count }`.
   - `/v1/admin/analytics/top-merchants?currency=USDC|EURC`: currency required, rows carry
     `volume` in that currency.
     The `...Usdc` field names are removed. The admin API is internal to `apps/web`, so
     this is not a published contract.
9. **Clean break on `/v1/stats/*`, no deprecated fields** (decision D2). The old scalar
   fields were wrong whenever a merchant had both currencies; keeping them would keep a
   wrong number alive. `@strimz/shared-types` goes 0.6.0 to 0.7.0 with a changeset that
   lists the response changes; the release note names them.
10. **One index migration**: `Transaction(merchantId, mode, status, blockTimestamp)`, which
    serves every volume window, the daily series and the forecast. Sessions, invoices,
    refunds and subscriptions already have `(merchantId, status)`, which is enough at
    current volumes; the ADR's verification step runs `EXPLAIN ANALYZE` on a seeded
    100k-row merchant before merge and adds an index only where a plan shows a sequential
    scan.
11. **No server cache.** Each summary is about seven indexed aggregates for one merchant.
    The web keeps React Query's 5-minute `staleTime` for analytics and invalidates
    `analyticsKeys.all` after invoice send/void/create and refund create/sign. A shared
    cache is added only if p95 for `/v1/stats/summary` exceeds 250 ms in production.
12. **Web.** Every card in the Context table reads `/v1/stats/summary`; the "loaded only"
    and `N+` qualifiers and the `SESSION_SAMPLE`/`INVOICE_SAMPLE` sampling go away. The home
    chart reads `/v1/stats/volume`. MRR, forecast and admin money cards render
    `CurrencyAmounts` through the existing `formatCurrencyTotals`, hiding zero currencies
    unless both are zero. The analytics LTV tab gets a USDC/EURC switch. The admin volume
    chart plots one series per currency. Response types move from the hand-written
    interfaces to `@strimz/shared-types`. Tables (lists) keep paging as they are.

## Diagram

```mermaid
sequenceDiagram
  participant W as Web dashboard
  participant A as API /v1/stats
  participant DB as Postgres
  W->>A: GET /v1/stats/summary (session or key with analytics_read)
  par one statement per section
    A->>DB: Transaction: sum(amount), sum(feeAmount), sum(netAmount) GROUP BY currency, window
    A->>DB: PaymentSession: count GROUP BY status; sum(amount) WHERE confirmed GROUP BY currency
    A->>DB: Invoice: count GROUP BY status; sum(total) GROUP BY status, currency
    A->>DB: Refund: count GROUP BY status; sum(amount) WHERE completed GROUP BY currency
    A->>DB: Subscription: count GROUP BY status
    A->>DB: Customer: count
  end
  DB-->>A: rows keyed by currency
  A->>A: toCurrencyAmounts (all currencies, "0" default, unknown currency throws)
  A-->>W: StatsSummary (validated against shared-types schema in tests)
```

## Consequences

- Every dashboard figure is exact regardless of how many rows exist, and no figure mixes
  EURC into USDC.
- Integrators reading `/v1/stats/mrr`, `/ltv` or `/forecast` must update; `/ltv` now
  requires `currency`. The blast radius is small: Strimz has not launched on mainnet, and
  since 2026-10-03 a key needs the new `analytics_read` scope to call them at all.
- Admin figures default to live mode, so before mainnet launch the admin home shows zeros
  unless the operator switches to test. That is the correct reading of live volume.
- LTV starts returning real customers for indexer-written transactions.
- One more endpoint and one more index to maintain. The summary does seven queries per
  page view instead of one paged list query; each is an indexed aggregate for one
  merchant.
- No FX: Strimz cannot show a single "total revenue" number. That is deliberate.

## Alternatives considered

- **Keep the old scalar fields deprecated next to new `byCurrency` fields.** Lost: the
  scalars are wrong for any merchant with EURC, and reinterpreting them as USDC-only
  silently changes their meaning. A clean break on 0.x is honest and cheap pre-launch.
- **Per-resource summary routes (`/v1/invoices/summary`, `/v1/refunds/summary`, ...).**
  Lost for now: the home page needs four sections at once, and each route would need its
  own scope decision. Possible later if an integrator asks for one resource's summary.
- **`CurrencyAmounts` as an array of `{ currency, amount }` with only non-zero entries.**
  Lost: clients must search the array and tests cannot tell "zero" from "missing". A fixed
  object keyed by currency is typed and total.
- **Convert EURC to USD for one total.** Lost: needs a rate source, a timestamp policy and
  rounding rules; that is its own ADR if it is ever wanted.
- **Materialised daily rollup table.** Lost for now: correct invalidation on reorgs and
  late indexing is real work, and current volumes do not need it.
- **Computing aggregates in the web by loading every page.** Lost: unbounded requests and
  memory in the browser.

## Decisions for the maintainer

- **D1. One `/v1/stats/summary` endpoint with all sections.** Recommended. Alternative:
  per-resource summary routes.
- **D2. Clean break on `/v1/stats/mrr|ltv|forecast`, shared-types 0.7.0.** Recommended.
  Alternative: additive `byCurrency` fields with the old ones deprecated for one minor.
- **D3. `CurrencyAmounts` is a total object `{ USDC, EURC }`.** Recommended.
- **D4. MRR counts `active` only, as today.** Recommended for this change; whether
  `at_risk` (in grace, still billed) should count is a product call worth a separate
  decision. Trialing does not count.
- **D5. Home "7-day volume" becomes all confirmed inbound transactions, including
  subscription charges, timed by block.** Recommended. Alternative: keep it as confirmed
  one-off sessions only.
- **D6. Admin money figures take `mode`, default `live`.** Recommended. Alternative:
  return both modes side by side.
- **D7. No `@strimz/sdk` stats resource in this change.** Recommended; types ship in
  shared-types so an SDK resource is a small follow-up.
- **D8. Fix LTV customer attribution, LTV paging and forecast calendar days in this
  change.** Recommended, since the shapes are being rewritten anyway. Alternative: split
  into a follow-up and keep only the per-currency split here.
- **D9. One index migration, no server cache.** Recommended.

## Verification

- Red first, failing on `main` (written, run, failing):
  `apps/api/test/e2e/stats-per-currency.e2e.test.ts`, 13 cases:
  - summary volume windows per currency (7d, 30d, all time), excluding pending, live-mode
    and another merchant's rows; summary section aggregates for sessions, invoices,
    refunds, subscriptions, customers; summary readable with `analytics_read` and `403
permission_denied` without it; `/v1/stats/volume` one row per day and currency;
  - MRR per currency (on `main` it returns `"39000000"`, USDC 30 plus EURC 9);
  - LTV ranked within one currency, `400` without currency, attribution through the
    session's customer;
  - forecast per currency from its own history;
  - admin overview per currency and per mode, merchant drilldown per currency, admin
    daily volume one row per day and currency (on `main` one row of `13000000`), admin top
    merchants ranked within one currency.
- The existing `analytics.e2e.test.ts` MRR assertion (`mrr: '60000000'`) changes to the
  per-currency shape, and `api-key-scope-enforcement.e2e.test.ts` gains the two new
  routes in its stats list. Both are shape updates required by D2, listed in the PR.
- Unit test for `toCurrencyAmounts`: all currencies present, unknown currency throws.
- Web: unit tests for the card mappers from `StatsSummary`; manual check of every card in
  the Context table with a merchant holding more than 100 sessions and invoices in both
  currencies, in light and dark mode.
- `EXPLAIN ANALYZE` on a seeded merchant with 100k transactions for each summary
  statement; `prisma migrate diff` shows no drift.
- `./scripts/preflight.sh` passes in full.
