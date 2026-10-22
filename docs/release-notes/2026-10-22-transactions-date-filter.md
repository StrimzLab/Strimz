---
date: 2026-10-22
feature: Date range filter on the dashboard Transactions page
scope: feat
scenario-impact: none
---

# Date range filter on the dashboard Transactions page

Closes #341. ADR: `docs/adr/ADR-2026-10-22-transactions-date-filter.md`.

## What shipped

- **Date filter:** a row of buttons on the Transactions page: Any time, Last 7 days, This month, Last month, Custom.
  - **Custom** shows **From (optional)** and **To (optional)** date boxes. Both days are included.
  - Days follow the merchant's time zone, and the page names it.
- **Bad range:** if From is after To, the page says "From must be on or before To" and keeps the last valid result. No request is sent.
- **Empty result:** when filters leave nothing, the page says "No transactions match these filters" and offers **Clear filters**. With no filter set, the first-run message is unchanged.
- **Export:** the CSV follows the range, and its file name carries it, for example `transactions-2026-09-01-to-2026-09-30.csv`.
- **Dashboard client:** the dashboard's own API client now sends `from` and `to` on `GET /v1/transactions`. It dropped them before.
- **Docs:** `dashboard/transactions` describes the date filter and the export name.

## Not changed

- The API, the SDK and the database.
- Other dashboard lists.
