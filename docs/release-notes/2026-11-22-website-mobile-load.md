---
date: 2026-11-22
feature: The website paints its hero on the first frame on phones, and recovers from stale pages
scope: fix
scenario-impact: updated
---

# Website on phones: no blank hero, no unstyled page

Fixes #496.

## What was wrong

- **Unstyled page on first visit.** A restored or cached page from an earlier deploy pointed at build files that no longer exist. Workers answers those with 404, so the page rendered without CSS.
- **Blank hero, then flicker.** An inline gate hid the hero until JavaScript hydrated, with a 3-second fallback. GSAP then hid it again to replay the intro.
- **Empty dashboard preview.** Every element of the preview started at `opacity: 0` and was revealed by timers that only start after hydration.
- **Build files re-checked on every visit.** `/_next/static/*` was served with `max-age=0`.
- **Accessibility:**
  - SplitText and the footer wordmark put `aria-label` on `<p>` elements, which ARIA prohibits;
  - the preview's `h3` followed the page's `h1`, skipping a heading level.

## What changed

- **Stale page guard** (`@strimz/web-shared`, in every app's root layout):
  - if a `/_next/static` stylesheet or script fails to load, or a build stylesheet never applies, the page reloads once;
  - a per-tab session stamp allows at most one reload a minute, so it can't loop;
  - if session storage is unavailable, it never reloads.
- **Long-term caching.** `public/_headers` in web, dashboard, checkout, admin, docs and demo-merchant caches `/_next/static/*` for a year as `immutable`. The OpenNext build copies it into `.open-next/assets`.
- **Hero intro in CSS.** The gate is removed, and the intro is a CSS animation that runs from the first frame.
  - It turns off under reduced motion.
  - Text rises without fading, so it counts as painted immediately.
  - GSAP keeps only the scroll parallax and the desktop tilt.
  - The page and pricing heroes are now server components.
- **Dashboard preview.**
  - The first scene renders complete on the server, then the cycle continues as before.
  - framer-motion loads through `LazyMotion`, so the animation engine arrives after first paint.
  - The preview is `aria-hidden` and has no headings: it is a mock-up with made-up data.
- **Smooth scrolling.** Lenis runs only on fine-pointer devices, since phones scroll natively, and is loaded with a dynamic import after mount.

## Measured

Measured on a local production build with a 390×844 phone viewport, Slow 4G and a 4× slower CPU.

|                                   | Before                | After                                      |
| --------------------------------- | --------------------- | ------------------------------------------ |
| LCP (hero paragraph)              | 1.8 s                 | 0.70–0.84 s, the same frame as first paint |
| Home first-load JS (gzip)         | 344 KB                | 317 KB                                     |
| Forced reflow after load          | spread over about 4 s | about 0.25 s, once                         |
| Lighthouse accessibility (mobile) | 95                    | prohibited ARIA and heading order fixed    |

- **The guard in a real browser:** an injected missing stylesheet triggered exactly one reload, and the page came back styled.
- **Live numbers:** they need a deploy to re-measure.
