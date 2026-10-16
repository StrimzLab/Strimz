# ADR for Dummies: Plans, payment links and payments in the dashboard

- **Status:** Accepted (2026-10-16, D1 to D5 as recommended)
- **Date:** 2026-10-16

## The Idea

Today a merchant cannot do several basic things from the dashboard without writing code:

- **Plans:** create a subscription plan;
- **Payment links:** create a payment link (a "payment session");
- **Payments:** see a list of their payments ("transactions");
- **Refunds:** refund a payment, because the refund form asks for a payment id the
  dashboard never shows.

We add these, in three steps:

1. **Payments.**
   - A Payments page and a page for each payment, with a **Refund** button that fills in
     the refund form for you.
   - The refund form shows the right currency (USDC or EURC).
2. **Payment links.**
   - A **New payment link** button: enter an amount, get a link to share.
   - A page for each link, showing whether it was paid, with the payment and a Refund
     button.
3. **Plans and subscriptions.**
   - A **Plans** page to create and retire plans.
   - A page per plan with its sign-up link.
   - The subscriptions list shows plan names, and each subscription gets its own page with
     its charges.

The help pages are rewritten to match what is really there.

## What the Person Sees

Merchants can run their billing from the dashboard alone. Nothing changes for their
customers.

## Choices for the maintainer

- **D1.** Ship it in three steps as above. Recommended.
- **D2.** A small API addition so a payment link or subscription can find its payments.
  Recommended.
- **D3.** Plans get their own menu entry. Recommended.
- **D4.** Payment links are created in a pop-up form. Recommended.
- **D5.** Leave customer pages, pausing subscriptions, cross-chain payments and plan editing
  for later; file the customer page as its own issue. Recommended.
