# ADR for Dummies: An honest "Use cases" page instead of "Customers"

- **Status:** Accepted (maintainer approved 2026-10-19)
- **Date:** 2026-10-19

## The Idea

The "Customers" page has no customers to show yet, because Strimz hasn't launched. We'll turn it into a **Use cases** page. It shows each kind of business how Strimz fits the way they bill, using only things Strimz really does.

## What the Person Sees

1. **A headline and a row of buttons:** SaaS, Marketplaces, Creators, Agencies, Global B2B. Tapping one jumps to that section, and the button stays lit while you read it.
2. **One section per kind of business.** Each has:
   - the job they need done;
   - the three Strimz features that do it, each linking to the guide that explains it;
   - a small picture of the product, such as a subscription screen, an invoice or a storefront;
   - a sample cost, clearly labelled "Sample": what a stated monthly amount would cost in Strimz fees over a year.
3. **Case studies** appear here automatically once we have real, named ones. Until then this part stays hidden.
4. **The same closing panel** as the homepage.

## Important Limitation

- **No invented customers, logos, quotes or numbers.**
- **No comparisons with cards or other ways of paying.** The issue's "before / after" idea is dropped.
- **We say what Strimz doesn't do.** For example, marketplaces are told that payments go to your wallet and Strimz doesn't split payouts to sellers.

## What Changes

- The page's address becomes `/use-cases`. Old `/customers` links forward there automatically.
- The menu and footer say "Use cases".
- "Talk to sales" goes, since there's no sales inbox. It becomes "Talk to us".

## What Does Not Change

- Prices, features, and every other page.
