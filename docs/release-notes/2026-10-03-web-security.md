---
date: 2026-10-03
feature: The web app closes its open image proxy, sends security headers, escapes CSV formulas and clears cached data on logout
scope: fix
scenario-impact: needs_automation
---

# Web: image proxy, security headers, CSV injection, logout cache

Four security fixes in `apps/web` from issue #132. A Content-Security-Policy is not
part of this release; it waits on
[ADR-2026-10-03-web-security-headers](../adr/ADR-2026-10-03-web-security-headers.md)
([plain-English version](../adr/ADR-2026-10-03-web-security-headers-for-dummies.md)).

## What was wrong

- `images.remotePatterns` allowed every HTTPS host, so `/_next/image` fetched and
  resized any image on the internet on Strimz's servers.
- No security headers were sent. Every page, including the dashboard, could be framed
  by any site.
- CSV exports wrote cells starting with `=`, `+`, `-`, `@`, tab or carriage return as
  they were. A customer name such as `=HYPERLINK(...)` ran as a formula when a merchant
  opened the export in a spreadsheet.
- Logging out left the TanStack Query cache in memory, so the next person to sign in
  on the same tab could see the previous merchant's data.

## What shipped

- **Image proxy closed.** `remotePatterns` is removed. The only remote images
  (merchant logo on checkout, dashboard upload preview) already use `unoptimized`, so
  they are loaded by the browser directly and never go through `/_next/image`.
  `/_next/image?url=https://...` now returns 400.
- **Security headers** on every route: `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Strict-Transport-Security: max-age=63072000`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
  `X-Frame-Options: DENY` on every route except `/pay/*` and `/sub/*`, which
  `StrimzCheckoutEmbed` loads in an iframe on merchant sites.
- **CSV formula escaping.** Every exported cell, header included, that starts with
  `=`, `+`, `-`, `@`, tab or carriage return is prefixed with `'`. Papa Parse's
  built-in `escapeFormulae: true` misses multi-line values, so the export uses its
  own pattern.
- **Cache cleared on logout.** The query cache is cleared whenever the Privy user
  signs out or a different user takes over the session. This covers the topbar and
  admin sign-out buttons, the inactivity logout, and a session that Privy ends itself.

## Who notices

- Exported values that start with `-` or `+` as text (for example a note `-50 refund`)
  now open with a leading `'`. Numbers exported as numbers are unchanged.
- A site that framed a Strimz page other than `/pay` or `/sub` now gets a blank frame.

## Not covered

- Content-Security-Policy and restricting who may frame checkout: see the ADR.
- Not exercised by hand in a browser against Privy; covered by unit tests and a
  production build checked with `curl`.
