---
date: 2026-11-23
feature: Readable dashboard tour in dark mode
scope: fix
scenario-impact: none
---

# Readable dashboard tour in dark mode

Issue: #559.

In dark mode the "Take a tour" popover showed a white card with an invisible title. And after an inactivity sign-out, the tour stayed on top of the sign-in page.

## Cause

The tour's styles were inside `@layer utilities`. driver.js's own CSS isn't in a layer, and an unlayered rule always beats a layered one. So driver.js kept its white background and its button and text colours. Our title colour still applied, because driver.js doesn't set one, which meant light text on a white card.

## What changed

- The tour styles now sit outside any layer, so the popover uses the card colours in both themes.
- The API keys step no longer mentions test keys. Strimz is live-only.
- The tour now closes when the merchant is signed out or moves to another page. Closing it that way doesn't count as finishing it, so it can still start again on the next visit.
- Tests fail if a tour rule ends up inside a layer again, if the tour mentions test keys, or if the tour outlives the dashboard.

## Verified

- The popover was checked in a browser with the dashboard's compiled CSS, in light and dark mode.
- `./scripts/preflight.sh` passed in full.
