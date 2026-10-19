---
date: 2026-10-19
feature: Use cases page replaces Customers, with a permanent redirect and renamed navigation
scope: feat
scenario-impact: none
---

# Customers becomes an honest Use cases page

Closes #281. Part of #286.

- **ADR:** `docs/adr/ADR-2026-10-19-use-cases-page.md` and its for-dummies companion.
- **Plan:** `docs/plans/2026-10-19-use-cases-plan.md`.

## What shipped

- **`/use-cases`** replaces `/customers`. `/customers` now returns a permanent (308) redirect, and the nav and footer say "Use cases".
- **Five sections:** SaaS, Marketplaces, Creators, Agencies and Global B2B. Each has:
  - the job in the owner's words;
  - three features, each linked to its guide;
  - a product mock;
  - a sample first-year fee from `firstYearFees`, labelled "Sample".
- **A sticky row of audience chips** jumps to each section and lights the one in view.
- **Marketplaces states plainly** that Strimz does not split payouts to sellers.
- **Case studies** render only when an entry has a real name, role and company. None do yet, so the section is hidden.
- **No comparisons with cards or other payment methods.** "Talk to sales" is gone; the closing panel offers "Talk to us".

## Before launch

- Add real, consented case studies to `components/marketing/use-cases/case-studies.ts` when merchants agree to be named.

## Operator steps

None. Web only; it deploys with the next Vercel build.
