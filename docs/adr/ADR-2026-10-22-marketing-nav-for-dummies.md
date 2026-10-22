# ADR for Dummies: A nav that shows what Strimz does

- **Status:** Accepted 2026-10-22
- **Date:** 2026-10-22

## The Idea

The top bar of the website gets menus. A visitor can see what Strimz does (Product), who it's for (Solutions), where developers go (Developers) and who we are (Company) without scrolling. Returning merchants get a clear **Sign in**.

## What the Person Sees

1. Across the top: Product, Solutions, Pricing, Developers, Company. On the right: Sign in, the light/dark switch and **Start free**.
2. They point at **Product**. A panel slides open listing Subscriptions, Payment recovery, Refunds, Invoices, Analytics, Payment links and checkout, and Storefront, each with an icon and one line.
3. They move to **Solutions**. The same panel smoothly changes shape to show SaaS, Marketplaces, Creators, Agencies and Global B2B.
4. Clicking an item takes them straight to that part of the homepage or the use-cases page.
5. On a phone, the menu button opens a full-screen menu where each group expands when tapped.
6. Keyboard users can do all of this with Tab, Enter, the arrow keys and Escape.

## Important Limitation

- There are no separate pages per product yet. Product items jump to the matching section of the homepage.
- The footer isn't changed here. It's part of #279.

## What Changes

- The nav has four menus and a Pricing link.
- **Get started** is renamed **Start free**, so it matches the rest of the site.
- One small library is added to build the menus properly.

## What Does Not Change

- The look of the bar: logo, glow on hover, shrinking on scroll, light and dark.
- The dashboard, checkout and docs.
- Hidden features (agent escrow, cross-chain) stay hidden, and the nav doesn't name a blockchain network.
