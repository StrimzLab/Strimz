---
date: 2026-10-03
feature: Light and dark theme with a toggle on every web surface
scope: feat
scenario-impact: needs_automation
---

# Light and dark theme on every web surface

The web app now has a dark theme. Each surface has a button that switches between light
and dark, and the first visit follows the visitor's system setting. The choice is
remembered in the browser and shared by every part of the site.

Closes #151. ADR: [ADR-2026-10-03-light-dark-theme](../adr/ADR-2026-10-03-light-dark-theme.md)
([plain-English version](../adr/ADR-2026-10-03-light-dark-theme-for-dummies.md)).

## What shipped

- **Theme tokens.** `@strimz/ui` defines every colour token for light and dark
  (`.dark` class, `@custom-variant dark`). Light values now match the brand hexes the
  pages used, so light mode looks the same. New tokens: `ink` and `ink-foreground` (brand
  navy panels that stay navy in both themes), `ink-muted` (grey text on those panels),
  `accent-hover`, `primary-hover`, `window-close`, `window-minimize`, `window-zoom`,
  `step-blue`, `step-purple`, `step-red`. `primary` is now `#F5F5F7` with navy text in
  dark mode.
- **One provider.** The root layout mounts `ThemeProvider` (next-themes, `class`
  attribute, default `system`, storage key `strimz-theme`). An inline script sets the
  theme class before first paint, so there is no flash of the wrong theme.
- **Toggles.** A labelled, keyboard-operable `ThemeToggle` ("Switch to dark theme" /
  "Switch to light theme") sits in the marketing nav and mobile menu, the auth form
  column, the dashboard top bar, a new admin header, the hosted checkout header and a
  new storefront header shared by the store and product pages. Docs use the Fumadocs
  theme switch, which now reads the same preference.
- **Colours.** 801 hardcoded light-only colour classes across marketing, auth,
  dashboard, admin, checkout, store, shared components and `@strimz/ui` primitives were
  replaced with tokens. The scan test fails the build if a new one appears.
- **Third-party widgets follow the theme:** Privy, Reown AppKit, Cloudflare Turnstile
  (re-renders on a theme change, which resets the challenge), Sonner toasts, the
  driver.js tour and Recharts tooltips and grid lines in dark mode.
- **Logos.** The Strimz wordmark switches to the white logo in dark mode, including the
  docs nav.
- **Embedded checkout.** `StrimzCheckoutEmbed` in `@strimz/sdk-react` takes an optional
  `theme="light" | "dark"`. The embedded checkout has no toggle. A `theme` query
  parameter is honoured only together with `embed=1` and is never stored.
- **demo-merchant** now defaults to the system theme instead of dark.

## Behaviour changes

- Existing `StrimzCheckoutEmbed` integrations without `theme` now follow the payer's
  system setting instead of always rendering light. Pass `theme="light"` to keep the
  old look.
- Light mode changes slightly where pages already used shadcn tokens: body text moves
  from `#0A0A0A` to `#050020`, muted text from `#737373` to `#58556A`, borders from
  `#E5E5E5` to `#E5E7EB`.

## Not changed

Invoice PDFs, Open Graph images and emails stay light.

## Verification

Vitest (web, `@strimz/sdk-react`), typecheck, lint, production build and the full
preflight. Nobody has looked at the surfaces in a browser yet; the ADR's manual pass
(each surface in light, dark and system mode, embedded checkout with and without
`theme`, reload in dark mode on a throttled network, keyboard operation of each toggle)
is still to do.
