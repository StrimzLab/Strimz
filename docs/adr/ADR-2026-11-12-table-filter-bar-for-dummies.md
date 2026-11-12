# ADR for Dummies: One standard filter bar for every dashboard table

- **Status:** Proposed, awaiting maintainer approval
- **Date:** 2026-11-12

## The Idea

Every table in the dashboard gets the same tidy filter bar: a search box, then one small button per filter (Status, Kind, Date). Clicking a button opens a short list where you tick what you want. Today, Transactions alone shows fifteen buttons over two lines; this replaces them with three.

## What the Person Sees

1. On Transactions, the row reads: search box, **Status**, **Kind**, **Date**, and **Columns** on the right.
2. They click **Status** and tick "confirmed" and "pending". The button now reads "Status: confirmed, pending", and the table shows only those.
3. They click **Date** and pick "Last 7 days", or "Custom" to type two dates.
4. A **Clear filters** link appears; one click resets everything.
5. They copy the page address and send it to a colleague, who sees the same filtered view.
6. Every other table (Payment links, Invoices, Refunds, Subscriptions, Plans, webhooks, AutoPay activity, API keys, and the admin merchant list) works the same way.

## Important Limitation

The search box still only searches rows already loaded on the page, as it does today. Searching everything on the server is a separate piece of work.

## What Changes

- One filter bar design across all tables, in light and dark themes.
- You can pick several values at once (for example two statuses).
- Date filters on more pages: Payment links, Subscriptions, Invoices, Refunds, webhook deliveries.
- New filters where there were none: Invoices, Refunds, webhook deliveries, AutoPay activity.
- Filters are kept in the page address, so reloading or sharing keeps them.
- Status names and colours in the filter match the table.

## What Does Not Change

- No database, contract or payment change.
- Anything already calling the API with a single filter value keeps working.
- Customers and webhook endpoints keep search only: they have nothing useful to filter by.

## How It Ships

Four pull requests, one after another:

1. The API learns to accept several values and date ranges.
2. The filter bar itself, used first on Transactions.
3. The other merchant pages.
4. The admin merchant list.
