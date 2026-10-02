# ADR for Dummies: Free trials actually start free

- **Status:** Accepted 2026-10-02
- **Date:** 2026-10-02

## The Idea

Merchants can give a subscription plan a free trial, for example 14 days. Today Strimz
ignores it and charges the customer the moment they subscribe. We make the trial real:
no charge at sign-up, first charge when the trial ends, and one free trial per customer
per plan.

## What the Person Sees

1. A customer opens a plan with a 14-day free trial and connects their wallet.
2. The page says "14-day free trial, first charge on 16 October".
3. They approve in their wallet. Nothing is taken from their balance.
4. The merchant's dashboard shows the customer as "trialing", with the trial end date.
5. On 16 October Strimz charges the first payment and the customer becomes "active".
6. If the same customer cancels and subscribes again later, the page says "charged
   today": the trial was already used.

## Important Limitation

Customers who subscribed to a trial plan before this change were charged straight away.
That is not undone automatically; the release note shows how to find them so the
merchant can decide whether to refund.

If a customer leaves the approval screen open for more than 15 minutes, they are asked
to approve once more, so the trial dates stay accurate.

## What Changes

- Trial plans charge when the trial ends, not at sign-up.
- The subscribe page tells the customer about the trial and the first charge date.
- Strimz double-checks every subscription request from its hosted page against the
  merchant's plan: price, billing period, currency and trial.
- The dashboard shows trial customers as "trialing" until their first payment.

## What Does Not Change

- The smart contracts, the database layout, fees and payouts.
- Plans without a trial behave exactly as before.
