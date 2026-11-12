---
date: 2026-11-12
feature: The standard filter bar on every merchant table
scope: feat
scenario-impact: none
---

# Filter bar on every merchant table

Third step of the standard dashboard filter bar (#426, ADR-2026-11-12-table-filter-bar). Every merchant dashboard table now uses the same bar as Transactions: search, filter buttons, Clear filters and Columns. Filters are kept in the page address.

| Page                                | Filters                                            |
| ----------------------------------- | -------------------------------------------------- |
| Payment links                       | Status, Created                                    |
| Plans                               | Status (starts on Active)                          |
| Subscriptions                       | Status, Created                                    |
| Invoices                            | Status, Created (new)                              |
| Refunds                             | Status, Created (new)                              |
| AutoPay Agent, Activity             | Capability, Outcome, Date (new)                    |
| Webhooks, Recent deliveries         | Status, Event, Date (new)                          |
| Webhook endpoint, Recent deliveries | Status, Event (this endpoint's events), Date (new) |
| API keys                            | Status (starts on Active)                          |

- **Defaults:** Plans and API keys still hide archived and revoked items by default. Clearing their filter goes back to Active; choosing both values shows everything.
- **Webhook stat cards:** the delivered, failed and success-rate cards keep counting all recent deliveries. Only the table follows the filters, and the CSV export follows the table.
- **API keys:** the "Show:" row above the table is gone; its filter is in the bar.
- **Search only:** Customers and webhook endpoints have nothing useful to filter by.
- **Code:** `DataTable` drops its old `toolbar` slot. Filters can now have a default (`multiFilter(values, initial)`).
