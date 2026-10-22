---
date: 2026-10-22
feature: Marketing nav with Product, Solutions, Developers and Company menus
scope: feat
scenario-impact: none
---

# Marketing nav with Product, Solutions, Developers and Company menus

Closes #271. ADR: `docs/adr/ADR-2026-10-22-marketing-nav.md`.

## What shipped

- **Menus:** the top bar reads Product, Solutions, Pricing, Developers, Company, then **Sign in** and **Start free**.
  - **Product:** Subscriptions, Payment recovery, Refunds, Invoices, Analytics, Payment links and checkout, and Storefront. They link to their homepage sections. A dark tile walks through the four steps from link to paid.
  - **Solutions:** the five use cases, plus "All use cases".
  - **Developers:** Documentation, Quickstart, SDKs, API reference, Webhooks.
  - **Company:** About, Contact.
- **One panel:** all menus open into a single panel that resizes as you move between them. With reduced motion it swaps without animating.
- **Keyboard:** Enter or Space opens a menu, Tab moves through its items, Escape closes it and returns focus, and the arrow keys move between menus.
- **Current page:** Pricing, Solutions or Company is marked as the current page where it applies.
- **Phones:** the menu sheet shows each group as an accordion.
- **Wording:** the nav button now says **Start free**, like the rest of the site.
- **Section jumps:** they land below the sticky bar.

## Not changed

- The footer (#279), the docs header, the dashboard and the checkout.

## Notes

- The ADR mentioned a small caret under the active menu. It's left out: it didn't line up with the trigger, and the panel reads fine without it.
- New dependency: `@radix-ui/react-navigation-menu` 1.2.22 in `@strimz/ui`.
