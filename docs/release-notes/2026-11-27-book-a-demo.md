---
date: 2026-11-27
feature: Book a demo
scope: web
scenario-impact: none
---

# Book a demo

Businesses can book a walkthrough before they sign up (#566). **Book a demo** opens the Strimz booking page on Zoho Bookings in a new tab.

## Where it shows

- **Home hero:** a secondary button next to **Start free**. It replaces **See how it works**; the How it works section itself is still on the page.
- **Closing section** of the home and pricing pages: next to **Start free**. It replaces **Talk to us**; the contact page is still in the nav under Company.
- **Docs:** a line on the docs home, under "Get started in 5 minutes", and at the top of Getting started.

It isn't in the nav.

## How

- The booking URL lives once, as `bookDemoUrl` in `packages/web-shared/src/lib/site-urls.ts`.
- Two components use it, `BookDemoLink` on the marketing site and `<BookDemo />` in the docs MDX.
- Both open the page with `target="_blank"` and `rel="noopener noreferrer"`, and tell screen readers it opens in a new tab.
- No section has more than two buttons (founder, 2026-11-27). A test checks this for the hero and the closing section.
