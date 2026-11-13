# ADR for Dummies: Show a customer's transactions on their page

- **Status:** Accepted 2026-11-13
- **Date:** 2026-11-13

## The Idea

A customer's page lists their payments, but the "Transactions" and "Refunds" sections stay empty even after they paid. When Strimz records a payment, it remembers which payment link it came from, but forgets to copy over who the customer was. This makes Strimz fill that in every time, and fixes the payments already recorded.

## What the Person Sees

1. A merchant opens a customer.
2. "Transactions" now lists the money that customer sent, both one-off payments and subscription charges.
3. "Refunds" lists refunds sent back to that customer.
4. Older payments show up too, once the update has run.

## Important Limitation

If a customer paid without giving their email, Strimz never knew who they were, so those payments still can't be tied to a customer.

## What Changes

- New payments and subscription charges are linked to their customer.
- A one-time update links the payments already recorded.

## What Does Not Change

- How payments are taken.
- The database layout. Only missing values are filled in.
- Webhooks and contracts.
