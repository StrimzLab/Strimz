# Plan: one standard filter bar for every dashboard table

ADR: `docs/adr/ADR-2026-11-12-table-filter-bar.md` (approved 2026-11-12). Issue #426.

## PR 1: API filters (this PR)

**Contract**

- `status`, `kind`, `tier`, `capability`, `outcome` and `eventName` take a comma list: 1 to 20 values, trimmed and de-duplicated. A single value is a one-item list.
- Each list route checks values against its Prisma enum and answers 400 `invalid_request` for an unknown one. Today an unknown value reaches Prisma.
- `eventName` also accepts dotted names (`payment.succeeded`), as it does now.
- `from`/`to` (inclusive/exclusive, `from < to`) are added on `createdAt` for payment sessions, subscriptions, invoices, refunds and webhook deliveries.

**Code**

- `common/schemas/list-query.ts`:
  - `listOf(item)`, `enumList(enum)`, `withDateRange(schema)`
  - `listQuerySchema` uses the generic token list
  - `datedListQuerySchema = withDateRange(listQuerySchema)`
- **Controllers:** each list route extends the shared schema with its enums, then passes arrays and `createdAt: dateRange(q)` to its service.
- **Services:** filters become `{ in: [...] }`. Param types become arrays of the Prisma enum, which removes the `as never` casts.
- **Web clients:** `merchant-api` and `admin-api` join array params with commas. Resource param types take `T | T[]`. Webhook deliveries gain `status`.

**Tests (api e2e, written first)**

- `list-filters.e2e.test.ts`, per route:
  - two statuses return both and exclude the third
  - a single value still works
  - an unknown value is a 400
  - transactions also check `kind`, agents activity checks `outcome`, deliveries check `eventName`
- `list-date-range.e2e.test.ts`:
  - `createdAt` ranges on the five new dated routes
  - "refuses from on a route without dates" moves from refunds to plans
- **Web unit test:** the client serialises `['a','b']` as `a,b`.

## PR 2: the filter bar on Transactions

- `@strimz/ui` `Popover`; `components/dashboard/filter-bar/` (`FilterBar`, `MultiSelectFilter`, `DateFilter`); `useTableFilters`; shared status labels and tones.
- `DataTable` gets a `filters` slot, column labels from headers, and "Clear filters" in the empty state.
- Transactions moves onto it.
- **Tests:** URL parsing and serialising, date presets, Transactions wiring.

## PR 3: the other merchant pages

Payment links, Plans, Subscriptions, Invoices, Refunds, AutoPay activity, Webhooks (both delivery tables), API keys. Customers and webhook endpoints get search only.

## PR 4: admin merchants

Status and Tier through the same bar. Server search is kept.
