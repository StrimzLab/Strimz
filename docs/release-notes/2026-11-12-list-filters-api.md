---
date: 2026-11-12
feature: List filters take several values, and more lists take a date range
scope: feat
scenario-impact: none
---

# List filters: several values and date ranges

First step of the standard dashboard filter bar (#426, ADR-2026-11-12-table-filter-bar).

- **Several values:** `status`, `kind`, `tier`, `capability`, `outcome` and `eventName` on list endpoints take one value or a comma list of up to 20 (`?status=confirmed,expired`). A list matches any of its values. A single value works as before.
- **Unknown values:** each list now checks values against its own statuses or kinds and returns `400 invalid_request` for one it doesn't have. Before, an unknown value reached the database and could return a 500.
- **Date ranges:** payment sessions, subscriptions, invoices, refunds and webhook deliveries accept `from` (inclusive) and `to` (exclusive) on when the record was created, like transactions and agent activity already did.
- **Web clients:** the dashboard's merchant and admin clients send arrays as comma lists. The webhook deliveries client gains `status`, and agent activity now sends its date range.
- **Docs:** the API overview has a "List filters" section; the payment sessions, invoices, subscriptions and webhooks pages point to it.

The SDK is unchanged: its filters are strings, so a single value works as before, and a comma list in a string is accepted.
