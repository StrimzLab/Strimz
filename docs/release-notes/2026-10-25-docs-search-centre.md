---
date: 2026-10-25
feature: Docs search dialog opens centred
scope: fix
scenario-impact: none
---

# Docs search dialog opens centred

Closes #368.

## What shipped

- **Before:** the docs search dialog opened far left of centre. The chevrons on collapsed sidebar sections pointed up instead of right.
- **Cause:** fumadocs ships Tailwind v3 CSS, which moves an element with `transform`. Our Tailwind v4 classes of the same name, such as `-translate-x-1/2` and `-rotate-90`, also set `translate` and `rotate`. Both applied, so each move happened twice.
- **Now:** `docs.css` resets `translate`, `rotate` and `scale` on every class that fumadocs moves with `transform`, so only fumadocs' move applies.

## Verification

- **New tests in `docs-surface.test.ts`:** they failed first. They read fumadocs' stylesheet, list every rule that sets the v3 transform, and check that `docs.css` resets each one under the same media query. A fumadocs upgrade that adds a class fails the test until it is covered.
- **In the browser:**
  - The dialog is exactly centred at 390, 1440 and 1920px, in light and dark, and in Chrome.
  - Collapsed sidebar chevrons turn −90° once.
  - The sidebar still collapses.
