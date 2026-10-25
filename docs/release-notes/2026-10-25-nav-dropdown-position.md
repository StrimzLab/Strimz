---
date: 2026-10-25
feature: Marketing nav menus open under the item that opened them
scope: fix
scenario-impact: none
---

# Nav menus open under their item

Closes #367.

## What shipped

- **Before:** the desktop nav centred every menu panel under the whole menu. Company and Product opened away from their own item.
- **Now:** when a menu opens, the nav measures its trigger and centres the panel under it. `nav-panel.ts` computes the centre and the bounds.
- **Wide panels:** a CSS `clamp()` on Radix's viewport width keeps a wide panel 8px inside the nav bar. Product's wide panel is the only one this moves.
- **Unchanged:** the panel still resizes and slides between menus, and the position follows a window resize. It respects reduced motion as before.

## Verification

- **New tests in `marketing-nav.test.ts`:** they failed first.
  - The panel centre and bounds.
  - The nav wiring: `onValueChange`, `--panel-x` and `clamp()`. The test also fails if the viewport is again centred with `left-1/2 -translate-x-1/2`.
- **In the browser:**
  - Measured at 1024, 1280, 1440 and 1920px. Solutions, Developers and Company open exactly centred on their trigger. Product is held 8px inside the bar's left edge.
  - Light and dark both checked.
  - Every marketing route loads.
