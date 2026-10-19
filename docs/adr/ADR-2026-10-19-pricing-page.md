# ADR: Pricing page with shared plan cards, fee calculator and plan rail

- **Status:** Accepted (maintainer approved 2026-10-19)
- **Date:** 2026-10-19
- **Issue:** #280 (part of #286)
- **Plan:** `docs/plans/2026-10-19-pricing-page-plan.md`

## Context

`/pricing` is the old page under the new nav and footer:

- a long paragraph;
- four flat cards with old buttons;
- a plain comparison table;
- a "Need a custom rate?" band.

The homepage (#270) already has better plan cards and a first-year calculator, but both live inside `home/pricing.tsx`.

The issue asks for:

- a calculator with "vs. typical card fees" savings;
- an "Us vs them" section;
- a "How plans move up" explainer;
- a comparison table and a pricing FAQ.

The maintainer has since ruled out comparisons with cards or other processors (2026-10-18), so the savings figure and "Us vs them" are dropped.

## Decision

### D1. Extract shared components

Move them out of `home/pricing.tsx` into `components/marketing/pricing/`:

- **`plan-cards.tsx`:** the spotlight cards, border beam and keycap CTAs. A `showExcluded` prop lists what a plan leaves out, which the pricing page uses.
- **`fee-calculator.tsx`:** the first-year calculator.
  - It gains a **plan after 12 months** readout from `planAfterYear`.
  - Slider labels follow the `(required) *` convention.

The homepage `Pricing` section composes the two, so its look does not change. CTAs keep the hrefs from `PRICING_PLANS`: `/login`, and `/contact` for Enterprise.

### D2. `lib/fee-estimate.ts`

- **`planAfterYear(monthlyVolume)`** returns the volume plan reached after twelve months.
- **`planAtVolume(allTimeUsd)`** does the same for a given all-time volume.
- **Both call `planForVolume` from `@strimz/shared-config`,** the same function the API uses to move merchants up.
- **Volume is passed as USDC in base units,** using `bigint` maths, never floats.

### D3. Page sections, in order

1. **Hero:** headline, a two-line summary drawn from `PLANS`, and a line-mask intro.
2. **Plan cards:** `PlanCards` with excluded items.
3. **How plans move up:** a rail with Free, Starter and Growth stops taken from `PLANS`. It fills as you scroll, and runs vertically on phones. Under it, three facts:
   - **Counts per currency:** 1,000 USDC or 1,000 EURC, as `planForVolume` checks each token.
   - **Never moves back down:** `planUpgradeFor` only upgrades.
   - **The fee is taken on-chain in the same transaction:** from the subscriptions guide.
4. **Fee calculator:** the shared `FeeCalculator`.
5. **Compare every plan:** `PLAN_COMPARISON`, restyled on theme tokens.
   - Solar check and minus icons, each with an accessible label.
   - A sticky header row.
   - A sticky feature column when the table scrolls sideways on phones.
6. **Pricing questions:** the shared FAQ accordion, made data-driven as `Faq({ title, items })`. The answers repeat only facts already in the docs and config:
   - when plans change;
   - per-currency volume;
   - how the fee is charged;
   - no monthly fee;
   - who pays the network fee;
   - Enterprise.
7. **Closing:** the shared navy closing panel.

### D4. Motion and states

- **Motion:** the homepage system (GSAP, `PLAY_ONCE`, `MOTION_OK`). Reduced motion shows final frames.
- **States:** each section sits in a `SectionBoundary`. Nothing on the page loads data, so there is no loading state.

### D5. Tests

- **Tier boundaries:** `planAtVolume` at $999.99 gives Free, at $1,000 gives Starter, at $49,999.99 gives Starter, and at $50,000 gives Growth. `planAfterYear` is checked for the default slider value.
- **`pricing-plans.test.ts`:** now checks that `/pricing` and the homepage read plans through the shared components, which import `@/lib/pricing-plans`.
- **`marketing-honesty.test.ts`:** the no-comparison guard extends to the pricing page and `components/marketing/pricing/`.

```
@strimz/shared-config PLANS, planForVolume
        │
        ├── lib/pricing-plans.ts ── PRICING_PLANS, PLAN_COMPARISON
        └── lib/fee-estimate.ts ─── firstYearFees, planAfterYear, planAtVolume
                │
components/marketing/pricing/{plan-cards, fee-calculator, plan-rail}.tsx
        │                                  │
home/pricing.tsx (homepage)       app/(marketing)/pricing/page.tsx
                                   + home/faq.tsx (data-driven) + home/closing.tsx
```

## Consequences

- One source for the cards and the calculator. The homepage and `/pricing` cannot drift apart.
- The pricing page uses the new design language, and the issue's acceptance criteria are met:
  - shared maths;
  - boundary tests;
  - tabular numbers;
  - a keyboard-operable slider;
  - the label convention.
- The page loses the old "Need a custom rate?" band. The Enterprise card and the FAQ cover it, and Enterprise CTAs go to `/contact`.
- The pricing page now loads the GSAP marketing bundle, which the homepage already ships.

## Alternatives considered

- **Restyle `/pricing` on its own.** This would duplicate the cards and the calculator, and they would drift. Rejected.
- **Keep a card-fee comparison.** Ruled out by the maintainer.
- **A month-by-month fee chart.** It adds a chart library or custom SVG for little gain over "plan after 12 months" plus the ladder. Deferred.

## Verification

- New and changed unit tests go red, then green.
- `./scripts/preflight.sh` passes in full.
- Chrome on `/pricing` and `/` at 1440, 768 and 390, in light and dark, and with reduced motion:
  - no overflow;
  - every section visible after scrolling;
  - the slider works by keyboard;
  - the table is usable on a phone.
- Sweep the other marketing pages, since the shared components and FAQ change.
