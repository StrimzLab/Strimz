# ADR for Dummies: Getting paid in the dashboard without writing code

- **Status:** Accepted (maintainer approved 2026-10-19)
- **Date:** 2026-10-19

## The Idea

When a new business opens the dashboard, the first steps it sees are for programmers: make an API key, send a test payment through code, set up a webhook. But the dashboard can already make a payment link, a plan or an invoice with no code at all. We'll put that path first and use everyday words.

## What the Person Sees

1. **A "Get paid" card on the home page** with two tabs:
   - **No code**, shown first:
     - create a payment link or plan;
     - share the link and try paying it in test mode;
     - see the payment land.
   - **With your developer:** the current API key, test payment and webhook steps.
   - Each step ticks itself off as you go. The card goes away after your first payment.
2. **Clearer menu names:** "Sessions" becomes **Payment links**, and the "Buyers" group becomes **Customers**. The page addresses don't change, so saved links keep working.
3. **Helpful empty pages.** An empty list says what will show up there and offers the no-code next step, such as "Create a payment link".
4. **Home cards in plain words:** "MRR" becomes "Monthly recurring revenue", each card says what its number means, the numbers roll up once when the page loads, and an empty chart says "Your first payment will show here".

## Important Limitation

- The developer tools (API keys, webhooks) stay as they are, just one tab away.

## What Changes

- The home page's first-run card, the menu names, the empty pages on seven lists, and the home cards' wording.

## What Does Not Change

- How payments, plans and invoices are created, and every page address.
