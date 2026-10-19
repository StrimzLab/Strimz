# ADR for Dummies: A pricing page that answers "what would I pay?"

- **Status:** Accepted (maintainer approved 2026-10-19)
- **Date:** 2026-10-19

## The Idea

The pricing page is still the old design: a long paragraph, four plain cards and a table. We'll rebuild it in the new homepage style so a business owner sees three things quickly:

- what they would pay;
- which plan they would be on;
- that their rate only goes down as they grow.

## What the Person Sees

1. **A short headline:** 0% on your first $1,000, then 0.5%, and 0.4% from $50,000. No monthly fee.
2. **The four plans** as the same cards used on the homepage, including what each plan leaves out.
3. **How plans move up:** a line that fills as you scroll, from Free to Starter at $1,000 to Growth at $50,000. Three plain facts sit under it:
   - volume counts per currency;
   - your plan never moves back down;
   - the fee comes out of the same transaction.
4. **The calculator:** slide what you take each month and see what you keep, the fees, your effective rate, and which plan you will be on after a year.
5. **A full comparison table** that also works on a phone.
6. **Pricing questions and answers.**
7. **The same closing panel** as the homepage.

## Important Limitation

- **No comparisons with cards or other payment companies,** as you asked. The issue's "savings vs cards" idea is dropped.
- **Every number comes from the real plan settings.** If prices change in one place, the page follows.

## What Changes

- The homepage pricing section and the pricing page share the same cards and calculator, so they always match.
- Tests check the plan boundaries: exactly $1,000 is Starter, and exactly $50,000 is Growth.

## What Does Not Change

- The prices, the plans and how they move up.
- Where the buttons lead: sign in, or Contact for Enterprise.
