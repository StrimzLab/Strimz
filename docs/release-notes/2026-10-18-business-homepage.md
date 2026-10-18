---
date: 2026-10-18
feature: Cinematic business homepage, marketing nav and footer, motion system and marketing UI kit
scope: feat
scenario-impact: none
---

# The Strimz homepage, rebuilt for business owners

Closes #270.

- **Covers** the homepage sections of epic #286: #271–#275, #277, #279, and the homepage fee
  calculator from #280.
- **ADR:** `docs/adr/ADR-2026-10-18-business-redesign-foundation.md` and its for-dummies companion.
- **Plan and benchmark:** `docs/plans/2026-10-18-homepage-redesign-plan.md`.

## What shipped

- **Hero.** An inset stage, pale in light mode and navy in dark.
  - WebGL payment streams converge on the original animated dashboard, which tilts with the
    pointer and carries a border beam.
  - The headline is "Stablecoin billing for {SaaS teams, marketplaces, creators, agencies, global
    B2B}".
- **Built for:** sector marquees.
- **Manifesto:** a gooey, scroll-scrubbed reveal.
- **How it works:** a pinned four-scene product story on desktop. On phones the scenes play on
  arrival.
- **Assurances:** the navy band with floating 3D coins over green light lines.
- **Billing tools:** five stacking sheets with live mocks for subscriptions, recovery, refunds,
  invoices and analytics.
- **Developers:** a themed 3D typing keyboard, copyable install rows and tabbed code.
- **Pricing:** spotlight plan cards and a first-year fee calculator.
- **FAQ,** and a **closing panel** with light pulses along the circuit into the logo tile.
- **Buttons:** every call to action is a keycap that sinks when pressed, green for the main
  action and neutral for the second.
- **Nav:** a floating glass bar with a spotlight hover, the theme toggle and a phone sheet.
- **Footer:** follows the theme and sits well clear of the navy closing panel, with cursor-reactive
  ASCII coins and a fading wordmark that unmasks into view.
- **Back to top:** a floating round key, bottom right, with a ring that fills as you scroll. It
  appears after one screen.
- **States:**
  - per-section error boundaries with "Try again";
  - Skeleton-style placeholders for lazy visuals;
  - an image fallback;
  - canvas states;
  - our own toaster;
  - copy success and failure.
- **Components adapted from Vengeance UI (MIT):** Morph Text, Pop Button, Border Beam, Light
  Lines, Spotlight Navbar, Gooey Text Reveal, Typing Keyboard, Animated Footer
  and FAQ Accordion. Each is credited in its file.
- **Removed:** the old homepage components, `react-scroll` and `react-fast-marquee`.
- **`apps/web/tsconfig.json`** pins React type resolution to the app's own `@types/react`.

## Before launch

- The About page still says "no chargebacks" and "card-rails". Fix it with its own issue.

## Operator steps

None. Web only; it deploys with the next Vercel build.
