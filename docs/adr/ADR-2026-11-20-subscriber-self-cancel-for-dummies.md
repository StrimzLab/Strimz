# ADR for Dummies: Let subscribers cancel, and always tell the merchant

- **Status:** Accepted 2026-11-20 by the founder
- **Date:** 2026-11-20

## The Idea

Today a customer can only cancel a Strimz subscription if the merchant built a cancel button, or by sending a technical transaction from their wallet. And when they do the second, the merchant isn't told, so the customer may keep getting access without paying.

We add a **Manage subscription** page. The customer connects their wallet, sees their subscriptions, and cancels with one signature. Strimz pays the network fee. The merchant always gets a "subscription cancelled" message that now says who cancelled: the customer, the merchant, or Strimz.

## What the Person Sees

1. **Customers:** a "Manage or cancel" link in every Strimz email. It opens a page listing their subscriptions with a Cancel button, then confirms: "Cancelled. You won't be charged again."
2. **Merchants:** every cancel reaches them, including ones made from the customer's wallet, with a new `cancelledBy` field.
3. **Developers:** one new optional field in the subscription data.

## Important Limitation

- **It needs the new subscription contract,** which is already planned for the audit fixes.
- **Cancelling is immediate.** Strimz stops charging right away. Whether the customer keeps access until the end of the period they paid for is up to the merchant.

## What Changes

- A new checkout page, two API routes, one database column, the indexer's cancel handling, the emails' links, and the docs.

## What Does Not Change

- How merchants cancel, how charging and renewals work, and the existing webhook fields.
