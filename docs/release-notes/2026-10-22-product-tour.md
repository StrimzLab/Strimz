---
date: 2026-10-22
feature: Dashboard tour on the homepage
scope: feat
scenario-impact: none
---

# Dashboard tour on the homepage

Closes #276.

## What shipped

- **See it in your dashboard:** a new section after "How it works". A simplified copy of the dashboard plays a short tour:
  - a pointer creates a "Team" plan at 80 USDC a month;
  - it copies the plan's sign-up link;
  - on Home, the payment appears in Recent activity and monthly recurring revenue goes up.
- **Steps beside it:** three text steps, highlighted as the tour plays, so the section reads without the animation.
- **Motion:**
  - the view zooms in on each click;
  - the tour plays once when it scrolls into view, and **Replay** plays it again;
  - it loads only as you approach it and pauses while the tab is hidden;
  - with reduced motion, it shows the finished Home screen.
- **Light and dark:** the tour follows the theme toggle.

## Not changed

- The dashboard. The tour copies its labels, and a test fails if one of them is renamed there.
- The hero mock. Its reduced-motion hook moved into `motion/reduced-motion.ts` so the tour can share it.
