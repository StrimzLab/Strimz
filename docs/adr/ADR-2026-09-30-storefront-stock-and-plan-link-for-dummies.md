# ADR for Dummies: Hold storefront stock during checkout and link subscription products to a plan

- **Status:** Accepted 2026-09-30
- **Date:** 2026-09-30

## The Idea

A storefront item should be held for a buyer while they pay and given back if they
walk away. Today the item is taken the moment they click Buy and never returned. And
subscription products in the storefront have never worked, because nothing tells them
which subscription plan to sell. We fix both.

## What the Person Sees

1. A merchant lists a T-shirt with 3 in stock.
2. Three shoppers click Buy. The store now shows sold out. A fourth shopper sees
   "sold out" and cannot start a checkout, instead of starting one that can never be
   fulfilled.
3. One shopper closes the tab. Thirty minutes later the store shows 1 left again.
4. Two shoppers pay. The merchant sees 1 in stock, which is correct.
5. The merchant adds a "Pro monthly" subscription product. The form asks which of
   their plans to sell. The Buy button on that product now takes the shopper to the
   subscription checkout, instead of showing an error.

## Important Limitation

If a shopper pays after their checkout has already timed out, the item was already put
back on the shelf, so the store may show one more in stock than the merchant really
has. This can happen today too. Fixing it needs a further change in the part of the
system that watches the blockchain, which is a separate decision.

Subscription products created before this change through the API have no plan and
never worked. They are not repaired. The merchant archives them and creates new ones.

## What Changes

- One database change: a checkout remembers which storefront product it is for.
- Stock is taken when a checkout starts and given back when it is cancelled or times
  out unpaid. Stock can no longer go negative.
- The product form in the dashboard asks for a plan when the product is a
  subscription. Developers using the SDK send a `planId` for subscription products.
- The "sold out" error the store receives is now named `sold_out`.

## What Does Not Change

- Prices, fees, payouts, refunds, invoices, the contracts, webhooks and the indexer.
- One-time products with unlimited stock behave exactly as before.
