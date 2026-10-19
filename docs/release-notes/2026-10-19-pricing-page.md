---
date: 2026-10-19
feature: Pricing page with shared plan cards, first-year calculator, plan rail, comparison table and pricing FAQ
scope: feat
scenario-impact: none
---

# A pricing page that answers "what would I pay?"

Closes #280. Part of #286.

- **ADR:** `docs/adr/ADR-2026-10-19-pricing-page.md` and its for-dummies companion.
- **Plan:** `docs/plans/2026-10-19-pricing-page-plan.md`.

## What shipped

- **Hero.** One line of rates built from `PLANS`. No monthly fee, and the rate never moves back up.
- **Plan cards.** The homepage cards, now shared, also list what each plan leaves out.
- **How plans move up.** A rail from Free to Starter at $1,000 to Growth at $50,000, which fills as you scroll and runs vertically on phones. Three facts sit under it:
  - volume counts per currency;
  - plans never move back down;
  - the fee is taken in the same transaction.
- **Fee calculator.** The shared homepage calculator, plus the plan you will be on by month 12. That plan comes from `planForVolume` in `@strimz/shared-config`.
- **Compare every plan.** The table on theme tokens, with screen-reader labels. On phones the feature column stays put.
- **Pricing questions** and the shared closing panel. On this page, "Start free" goes to `/login`, as the plan CTAs do.
- **No comparisons with cards or other processors.** The guard test now covers this page too.
- **Removed:** the old "Need a custom rate?" band. The Enterprise card and the FAQ cover it.

## Operator steps

None. Web only; it deploys with the next Vercel build.
