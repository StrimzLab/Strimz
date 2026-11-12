---
date: 2026-11-12
feature: The standard filter bar, first on Transactions
scope: feat
scenario-impact: none
---

# Filter bar on Transactions

Second step of the standard dashboard filter bar (#426, ADR-2026-11-12-table-filter-bar).

Transactions replaces its three rows of chips with one row: search, then **Status**, **Kind** and **Date** buttons, then **Columns**.

- **Status and Kind:** each opens a checklist; pick several values at once. The button shows what's picked ("Status: confirmed, pending", or "3 selected"), with an × to clear it. Status options show the same colour as the table's status pills.
- **Date:**
  - Presets: Any time, Today, Last 7 days, Last 30 days, This month and Last month.
  - Custom: two optional date fields, with the same validation and time-zone note as before.
- **Clear filters:** appears next to the filters when any is set, and in the empty state.
- **In the URL:** filters live in the page address (`?status=confirmed,pending&kind=refund&date=last_7_days`), so a reload or a shared link keeps them. Unknown values in the address are ignored.
- **Columns menu:** now names columns by their headers ("Payer", "When") instead of internal ids.

New shared pieces for the next pages:

- `@strimz/ui` `Popover` (on `@radix-ui/react-popover`, already in the lockfile)
- `components/dashboard/filter-bar` (`MultiSelectFilter`, `DateFilter`, `useTableFilters`, `useDateRange`)
- `lib/table-filters.ts`
- `TONE_DOT` next to `StatusPill`

Other tables are unchanged until the next PR.
