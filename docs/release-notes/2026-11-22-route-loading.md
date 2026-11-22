---
date: 2026-11-22
feature: A loading screen while moving between pages, in every app
scope: feature
scenario-impact: updated
---

# Loading screen between pages

Closes #537. Follows #496.

No app had a `loading.tsx`. On a slow phone, a tapped link could look frozen until the next page arrived.

## What changed

- **A shared loader.** `RouteLoader`, in `@strimz/web-shared`, is a ring of dots stepping round, based on the founder's design. It is drawn in `text-brand-text`, so it uses the dark green in light mode and the bright green in dark mode.
  - It fades in after 0.25 s, so quick page changes never flash it.
  - It holds still with reduced motion on.
  - It is a `role="status"` region with "Loading" for screen readers.
- **Where `loading.tsx` goes.** Each file sits inside its section's layout, so the nav, sidebar and shell stay in place:
  - web: marketing;
  - dashboard: app and auth;
  - checkout: checkout and storefront;
  - admin;
  - docs.

First page loads are unchanged: they stay server-rendered. The loader only appears while the next page loads.

## Tests

`route-loader.test.tsx` checks:

- the status role, the screen-reader text and the hidden dots;
- the brand colour;
- the delayed fade-in, and no motion with reduced motion;
- a `loading.tsx` in each of the seven sections, each using the shared loader.

It was also checked by eye on a phone viewport, in light and dark.
