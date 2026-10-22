# ADR for Dummies: Date range filter on the Transactions page

- **Status:** Accepted 2026-10-22
- **Date:** 2026-10-22

## The Idea

On the dashboard's Transactions page, a merchant can pick a period, such as last month, and see only the payments from that period. Exporting to CSV then gives them just that period too.

## What the Person Sees

1. Next to the kind and status buttons there is a new row: Any time, Last 7 days, This month, Last month, Custom.
2. They click **Last month**. The table reloads and shows only last month's transactions.
3. They click **Custom** and pick two days. Both days are included. A short line says the dates are in their own time zone and names it.
4. If they pick a start day after the end day, they see "From must be on or before To", and the table stays as it was.
5. If nothing matches, the page says "No transactions match these filters" and offers **Clear filters**.
6. **Export CSV** downloads only what's on screen, in a file named after the dates.

## Important Limitation

- The dates follow the time zone of the computer they're using. Someone travelling sees days in their current zone.
- Reloading the page clears the filter, as it already does for kind and status.
- The date boxes are the browser's own date picker, so they look a little different in Chrome, Safari and Firefox.

## What Changes

- A date filter on the Transactions page.
- When a filter empties the list, the page says so and offers to clear it, instead of showing the "No transactions yet" message.
- Exported files are named after the date range.

## What Does Not Change

- The API, the SDK and the database.
- Every other list in the dashboard.
- The kind and status filters.
