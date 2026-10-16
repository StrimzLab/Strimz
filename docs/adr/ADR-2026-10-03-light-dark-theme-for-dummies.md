# ADR for Dummies: A light and dark mode switch on every Strimz page

- **Status:** Accepted 2026-10-03
- **Date:** 2026-10-03

## The Idea

Strimz pages are always white today, even for people whose computer or phone is set to
dark mode. Our own rule says every page must offer a light/dark switch. We propose a
dark colour palette, a switch in the header of every part of the site, and a way for
merchants who embed our checkout to choose light or dark for it.

## What the Person Sees

1. On a first visit, the site matches the device setting: dark if the device is in dark
   mode, light otherwise.
2. A sun or moon button sits in the header of the marketing site, the login and signup
   pages, the merchant dashboard, the admin area, the hosted checkout, the public
   stores, and the docs. Clicking it (or pressing Enter or Space on it) switches the
   theme.
3. The choice is remembered on that browser and applies across the whole site, so a
   merchant who picks dark on the marketing site lands in a dark dashboard.
4. The page never flashes white before turning dark; the right theme is applied before
   anything is drawn.
5. The login popup (Privy), the wallet picker (Reown), the bot check on signup
   (Cloudflare Turnstile) and the pop-up notifications all follow the same theme.
6. A merchant who embeds checkout in their own site can ask for `light` or `dark`. If
   they do not, the checkout follows the payer's device setting. The embedded checkout
   shows no switch of its own, because it lives inside the merchant's page.

## Decisions We Need From You

1. **The dark colours.** A near-black page (`#0B0B12`) with slightly lighter cards,
   off-white text, a softer grey for secondary text, and the Strimz green unchanged.
   The navy brand sections (footer, call-to-action bands, the login side panel, store
   banners) stay navy in both modes. The exact values are in the technical ADR.
2. **Small light-mode adjustment.** Body text becomes the brand navy (`#050020`)
   instead of near-black, and secondary text and borders move to the brand greys the
   pages already use. Most pages will look identical; a few shadcn-styled spots shift
   slightly.
3. **No switch inside an embedded checkout.** This is an exception to "every page has
   a switch": the merchant decides the embed's look instead.
4. **A new option in the published React SDK** (`theme` on `StrimzCheckoutEmbed`). This
   is a change to a published package, so it needs your approval.
5. **One pull request or four.** One pull request covers every surface and closes the
   issue. Four smaller ones are easier to review but take longer to finish.

## Important Limitation

- The invoice PDF, link-preview images and emails stay light; they are printed or shown
  by other apps, not by our site.
- Existing embedded checkouts will start following the payer's device setting instead
  of always being white. Merchants who want white must pass `theme="light"`.
- White text on the Strimz green is hard to read for some people in both modes. That is
  a brand choice we are not changing here.
- Automated checks prove the pages use theme colours, not that they look good. Every
  page still needs to be looked at in both modes before release.

## What Changes

- A switch in the header of every part of strimz.finance, remembered per browser.
- A dark version of every page, built from one shared set of colours.
- About 800 fixed colours across 83 files replaced by named theme colours.
- The React SDK's checkout embed accepts `theme="light"` or `theme="dark"`.
- The demo merchant site starts in the device's mode instead of always dark.

## What Does Not Change

- No change to payments, subscriptions, the API, the database, contracts or webhooks.
- The Strimz green, fonts, layout and wording stay the same.
- Light mode looks as it does today, apart from the small adjustment in decision 2.
