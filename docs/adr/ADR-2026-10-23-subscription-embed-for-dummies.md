# ADR for Dummies: Subscribe buttons, embeds and "send me back" links for plans

- **Status:** Accepted 2026-10-23
- **Date:** 2026-10-23

## The Idea

For one-off payments, a merchant can drop a "Pay with Strimz" button or an embedded checkout on their own site. When the payer finishes, the merchant's site hears about it and the payer can be sent back.

Subscription plans don't have any of that yet. A merchant can only share a link to the Strimz sign-up page. When someone subscribes, they stay on the Strimz page, and the merchant's site never hears about it.

We give subscription plans the same tools: a "Subscribe with Strimz" button, an embedded sign-up form, and success and cancel links that send the subscriber back to the merchant's site.

## What the Person Sees

**Merchants:**

1. When creating a plan, two new optional fields: a success link and a cancel link.
2. On the plan page, a new "After checkout" card to view and change those links later.
3. A ready-to-copy code snippet for a "Subscribe with Strimz" button.

**Subscribers:**

1. After subscribing on the full Strimz page, they're sent back to the merchant's site, if the merchant set a success link.
2. If they cancel, they go to the merchant's cancel link, or see "Subscription cancelled. Nothing was charged."
3. In a button popup or an embedded form, the merchant's site is told the result straight away and decides what happens next.

## Important Limitation

- **Short wait:** right after subscribing, Strimz takes a few seconds to record the new subscription. The page shows "Finishing up…" for up to 30 seconds so it can pass the subscription's ID back to the merchant. If recording takes longer, the merchant still gets the transaction and the usual webhook, just without the ID in that moment.
- **Plans stay fixed:** a plan's price, billing period and trial still can't be changed after creation. Only the two links can.

## What Changes

- **Plans:** two new optional links, which can be changed any time.
- **The sign-up page:** it works inside a merchant's site (popup or embedded) and reports the result back.
- **Developer packages:** they get a subscribe button, an embed and a way to update a plan's links.
- **Docs:** they explain all of the above.

## What Does Not Change

- **Billing:** how subscriptions are signed, charged and cancelled.
- **Payments:** one-off payment checkout.
- **Plain links:** existing plan links keep working as before.
