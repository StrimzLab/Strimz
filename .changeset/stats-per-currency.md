---
'@strimz/shared-types': minor
---

Add `analytics` schemas and types (also at `@strimz/shared-types/analytics`) for the `/v1/stats/*` responses. Money is now a `CurrencyAmounts` object, `{ USDC, EURC }` in base units, with every currency always present: USDC and EURC are never added together.

- New: `currencyAmountsSchema`, `paymentCurrencies`, `statsSummarySchema` (`GET /v1/stats/summary`), `statsVolumeSchema` and `statsVolumeQuerySchema` (`GET /v1/stats/volume`), `resolveStatsVolumeRange`, and the admin response schemas.
- Breaking response changes described by these types: `GET /v1/stats/mrr` returns `mrr` as `CurrencyAmounts` instead of a string; `GET /v1/stats/ltv` requires `?currency=USDC|EURC` (`statsLtvQuerySchema`) and returns `currency`, a real `nextCursor` and `hasMore`; `GET /v1/stats/forecast` returns `{ byCurrency: { USDC, EURC } }`, each with `confidence`, `last90DayRevenue`, `next30`, `next60`, `next90`.
