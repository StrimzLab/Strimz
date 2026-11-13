# ADR for Dummies: An audit log in the admin console

- **Status:** Accepted 2026-11-13
- **Date:** 2026-11-13

## The Idea

Strimz already writes down every sensitive action: who changed an admin's role, who paused a contract, when a merchant's payout address changed. Today the only way to see any of it is the alert emails. This adds an "Audit log" page to the admin console where operators can look back over everything, filter it, and see whether each alert was emailed.

## What the Person Sees

1. An admin opens **Audit log** in the admin console.
2. A list shows the newest actions first: what happened, to what, by whom, and when.
3. Blockchain actions, such as a contract being paused or a role changing, link to the transaction on the block explorer.
4. Filters narrow the list by type, by blockchain or admin action, and by date.
5. Each alert shows whether its email has gone out yet.
6. Clicking a row shows its full details.

## Important Limitation

Read-only admins can't see this page, because some entries include the IP address an admin acted from. A version with that hidden could come later.

## What Changes

- New "Audit log" page in the admin console, in light and dark.
- A new admin-only API route behind it.

## What Does Not Change

- What gets recorded, and the alert emails.
- Merchants see nothing new.
- The database, contracts and payments.
