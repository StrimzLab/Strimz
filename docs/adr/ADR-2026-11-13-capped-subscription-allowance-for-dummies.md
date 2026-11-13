# ADR for Dummies: Subscribers approve a year, not forever

- **Status:** Accepted 2026-11-13
- **Date:** 2026-11-13

## The Idea

When someone subscribes, their wallet gives Strimz permission to take the monthly payment. Today that permission is unlimited, and wallets show a scary warning about it. This change limits it to 12 payments' worth, or exactly the plan's total if the plan has an end date.

When that permission is about to run out, the subscriber gets an email with a link. They click, sign once more, and the subscription carries on. Strimz pays the network fee for that signature.

## What the Person Sees

1. At checkout, the subscriber sees "You're approving up to 12 × 25 USDC", and their wallet shows that limit instead of "unlimited".
2. Months later, two payments before the limit runs out, they get an email: "Renew your approval to keep your subscription."
3. The link opens a page showing their plan. They connect the same wallet and sign. That's it.
4. If they ignore it, the subscription becomes "at risk" when a payment can't go through, as it does today when a payment fails. They can still renew to recover it.

## Important Limitation

People who subscribed before this change keep their unlimited permission. We don't take anything back. Subscribers who left no email address get no reminder, though the merchant is still told.

## What Changes

- Smaller, clearer approval at checkout.
- A reminder email, and a one-click renewal page.
- Strimz pays the fee for renewals.

## What Does Not Change

- How much or how often subscribers are charged.
- The smart contracts.
- Existing subscriptions.
