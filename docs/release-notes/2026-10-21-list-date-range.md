---
date: 2026-10-21
feature: from / to date range on transaction and agent activity lists
scope: feat
scenario-impact: needs_automation
---

# List transactions by date

Closes #333.

- **ADR:** `docs/adr/ADR-2026-10-21-list-date-range.md` and its for-dummies companion.

## What shipped

- **Date filters:** `GET /v1/transactions` and `GET /v1/agents/activity` accept `from` and `to`. Both are ISO-8601 timestamps with a time zone.
  - **Start and end:** `from` is included and `to` is not, so `from=2026-10-01T00:00:00Z&to=2026-11-01T00:00:00Z` is exactly October.
  - **What gets filtered:** transactions by the time they settled on Arc (`blockTimestamp`), agent activity by `createdAt`.
  - **Combining:** the range works with the existing filters and with `cursor`.
  - **Refused with 400 `invalid_request`:** a bare date, a timestamp without an offset, unreadable input, or `from` not before `to`.
- **Other list routes** still refuse `from` and `to` (400).
- **`@strimz/sdk`:** `transactions.list` and `agents.listActivity` already declared `from` and `to`, and now they work. Each field has a short note on its format (patch changeset).
- **Database:** new index `Transaction [merchantId, mode, blockTimestamp]`, migration `20261021120000_transaction_time_index`.
- **Docs:** `dashboard/transactions.mdx` shows the one-month example.

## Not changed

- Response shapes, contracts, the indexer, the scheduler, and webhook and BullMQ payloads.
- The dashboard's transactions page. It has no date picker yet.
