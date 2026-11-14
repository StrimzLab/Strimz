# ADR for Dummies: Split the website into five smaller sites so Cloudflare hosts them for free

- **Status:** Accepted 2026-11-14
- **Date:** 2026-11-14
- **Replaces:** the plan to put the whole website on one Cloudflare Worker.

## The Idea

Cloudflare's free plan only takes sites up to a certain size, and our website is about twice that. Most of the weight is wallet and sign-in code that every page loads, even pages that never use it.

We split the website into five smaller sites, each with one job, and load the wallet code only where it's needed. Each one then fits the free plan. Solva is set up the same way.

## What the Person Sees

| Address                   | What's there                                                          |
| ------------------------- | --------------------------------------------------------------------- |
| `strimz.finance`          | The marketing pages: home, pricing, use cases, about, contact, legal. |
| `docs.strimz.finance`     | The developer docs.                                                   |
| `app.strimz.finance`      | Sign-up, sign-in and the merchant dashboard.                          |
| `admin.strimz.finance`    | The Strimz team's admin area, separate from merchants.                |
| `checkout.strimz.finance` | Payment pages, subscription pages and merchant stores.                |
| `fanline.strimz.finance`  | The demo shop.                                                        |

- Old addresses still work. `strimz.finance/login` or `strimz.finance/pay/...` forward to the right place.
- Payment links and emails point at the new addresses.
- The dashboard and checkout pages show a short loading state before the wallet buttons appear.

## Important Limitation

- **Shops on older versions of our toolkit:** a shop that embeds checkout with an older version still sends payers to the old address. The forwarding takes them to the new one, but embedded checkouts should update to the new version.
- **This is a big reorganisation of the website code.** We test every site before switching any address.

## What Changes

- The website code becomes five apps.
- Admin emails and invite links point to the admin address.
- Our React toolkit points to the new checkout address.
- The subscription renewal email links to the checkout address.
- Settings on the server and in Privy list the new addresses.

## What Does Not Change

- The pages, the dashboard, the checkout and the docs, apart from their addresses.
- The backend, the contracts and the payment flows.
- No Cloudflare bill: everything stays on the free plan.
