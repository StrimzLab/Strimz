---
date: 2026-10-03
feature: Dashboard and stats figures are computed on the server and kept per currency
scope: feat
scenario-impact: needs_automation
---

# Stats per currency, computed on the server

Every money figure on the merchant dashboard and the admin dashboard is now computed by the
API over every row, and USDC and EURC are always shown separately. The "loaded only"
notes and the `N+` counts are gone.

Closes #150. ADR: [ADR-2026-10-03-stats-per-currency](../adr/ADR-2026-10-03-stats-per-currency.md)
([plain-English version](../adr/ADR-2026-10-03-stats-per-currency-for-dummies.md)).

## What was wrong

- The dashboard cards were computed in the browser from the first 100 loaded rows.
- `/v1/stats/mrr`, `/ltv` and `/forecast` and the admin overview, merchant drilldown,
  daily volume and top merchants added EURC to USDC and labelled the total USDC.
- Admin figures mixed test-mode and live-mode activity.
- `/v1/stats/ltv` ignored `cursor`, always said `hasMore: false`, and found no customer for
  transactions written by the indexer.
- `/v1/stats/forecast` returned `last90DayRevenue: "0"` with fewer than 7 revenue days and
  regressed over the index of days with revenue instead of calendar days.
- The home "7-day volume" read payment sessions timed by their last update and missed
  subscription charges.

## Breaking API changes

Merchant API (`@strimz/shared-types` 0.8.0 carries the new types):

| Endpoint                 | Before                                                        | After                                                                                                   |
| ------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `GET /v1/stats/mrr`      | `{ mrr: "39000000", activeSubscribers }`                      | `{ mrr: { USDC, EURC }, activeSubscribers }`                                                            |
| `GET /v1/stats/ltv`      | `?limit&cursor`, `{ data, nextCursor: null, hasMore: false }` | `?currency=USDC\|EURC` required (else `400 invalid_request`), `{ currency, data, nextCursor, hasMore }` |
| `GET /v1/stats/forecast` | `{ confidence, last90DayRevenue, next30, next60, next90 }`    | `{ byCurrency: { USDC: {...}, EURC: {...} } }`, same fields per currency                                |

New: `GET /v1/stats/summary` and `GET /v1/stats/volume?from&to`, both behind the
`analytics_read` scope. There are no deprecated fields.

Admin API (internal to the web app): `/v1/admin/overview`, `/v1/admin/merchants/:id`,
`/v1/admin/analytics/volume` and `/v1/admin/analytics/top-merchants` take
`?mode=live|test` (default `live`) and return per-currency objects. The `...Usdc` field
names are removed. `top-merchants` requires `?currency=USDC|EURC`; volume rows carry a
`currency`.

## What shipped

- Shared money shape `CurrencyAmounts` and every stats response schema in
  `@strimz/shared-types` (minor).
- Every money aggregate is a SQL `sum(...::numeric)` grouped by currency; one helper turns
  the rows into `{ USDC, EURC }` and throws on an unknown currency.
- Summary volume counts confirmed inbound transactions (refunds excluded), including
  subscription charges, timed by block.
- LTV attributes a payment through its payment session or subscription when the
  transaction has no customer, and pages with an opaque keyset cursor.
- Forecast regresses each currency over calendar days; `last90DayRevenue` is always the
  real total.
- Migration `20261003210000_transaction_stats_index`: index
  `Transaction(merchantId, mode, status, blockTimestamp)`.
- Web: every dashboard card reads `/v1/stats/summary`, the home chart reads
  `/v1/stats/volume`, the analytics LTV tab has a USDC/EURC switch, and the admin pages
  show per-currency figures with a live/test switch.

## Deploy

1. Run `prisma migrate deploy` (one `CREATE INDEX`; it locks `Transaction` writes while it
   builds).
2. Deploy the API and the web app together: the old web app cannot read the new shapes.
3. Admin figures now default to live mode, so before mainnet launch the admin home shows
   zeros until an operator switches to test.

## Not covered by automation

The ADR's manual checks were not run: every card with a merchant holding more than 100
sessions and invoices in both currencies, and `EXPLAIN ANALYZE` of each summary statement
on a merchant with 100k transactions.
