---
date: 2026-11-28
feature: Sign-up check fixed, docs links open in a new tab, docs without internals
scope: fix
scenario-impact: none
---

# Sign-up check fixed, docs links open in a new tab, docs without internals

## Sign-up "Verify you are human" no longer loops (#588)

[ADR-2026-11-28-signup-turnstile-loop](../adr/ADR-2026-11-28-signup-turnstile-loop.md).

- **The bug:** on `/signup`, the check spun and came back empty forever, so nobody could create an account. Since #575, sign-up restarted the widget to get a second token for the test account, and each restart cleared the first one.
- **The fix:** sign-up keeps the one token its check produces and never restarts the widget by itself. The "Try again" link still does.
- **The test account** asks for its own check on "Setting up your test account", only when the test API wants one. The second token slot is gone.
- The sign-up and login pages, and the site's "Sign in" and "Start free" buttons, are unchanged.

## Docs links on the marketing site open in a new tab (#585)

- A new `SiteLink` component renders Next's `Link`, and gives docs links `target="_blank"`, `rel="noopener noreferrer"` and a screen-reader "(opens in a new tab)".
- It's used for the nav menus, the mobile menu, the footer, the home sections, the use-case pages and every `PopLink`.
- A test fails if any link with a computed `href` on the marketing site skips `SiteLink`.

## The docs teach using Strimz, not running it (#586)

- **Removed:** the Operations section and its four self-hosting pages. Old `/docs/self-hosting/*` URLs redirect to the docs home.
- **Rewritten:** "How Strimz fits together" becomes "How Strimz works", following a payment and a subscription from the merchant's side.
- **Swept:** internal service names, Strimz's own environment variables, contract role names, KMS and queue details, and links to private source paths are gone from every page. Merchant-facing facts (timings, statuses, webhook events, fees, what the payer signs) stay.
- **Marketing FAQ:** "Where can I find the technical details?" no longer mentions self-hosting.
- A test fails if docs content mentions self-hosting or operator-only settings again.
