# Pricing page plan (#280)

## Brief

- **Who it's for:** the business owner deciding whether Strimz is affordable.
- **What they should leave knowing:**
  1. What they would pay.
  2. Which plan they would be on.
  3. That the rate only ever goes down.
- **Rules:**
  - No comparisons with cards or other processors. This overrides the issue's "vs. typical card fees" and "Us vs them" items, at the maintainer's direction.
  - Every number comes from `PLANS` in `@strimz/shared-config`, through `lib/pricing-plans.ts` and `lib/fee-estimate.ts`.

## Wireframe (desktop 1440)

```
┌ glass nav ──────────────────────────────────────────────────────────────────────────┐
 ● Pricing
 Pay only for what you process.                       (Sora, line-mask intro)
 0% on your first $1,000, then 0.5%, and 0.4% from $50,000.
 No monthly fee, and your rate never moves back up.
 ┌ Free ─────┐ ┌ Starter ★ beam ┐ ┌ Growth ──┐ ┌ Enterprise ┐   shared PlanCards (homepage)
 │ 0%  …     │ │ 0.5% …         │ │ 0.4% …   │ │ Custom …   │   + excluded items, keycap CTAs
 └───────────┘ └────────────────┘ └──────────┘ └────────────┘
 HOW PLANS MOVE UP
 ●━━━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●          rail fills as you scroll
 Free 0%             Starter 0.5%                   Growth 0.4%
 sign-up             from $1,000 all-time           from $50,000 all-time
 [Counts per currency] [Never moves back] [Fee taken in the same transaction]
 ┌ shared FeeCalculator ─────────────────────────────────────────────┐
 │ Taken each month (required) *  [slider]  ladder │ You keep / fees  │
 │                                                 │ rate / plan at   │
 │                                                 │ month 12         │
 └───────────────────────────────────────────────────────────────────┘
 Compare every plan     sticky header, sticky first column on phones, Solar icons
 Pricing questions      accordion (shared Faq), pricing-only answers
 ═══ shared navy Closing (circuit + logo tile) ═══
```

## Phone (390)

- The cards stack.
- The rail runs vertically.
- The calculator stacks.
- The table scrolls sideways inside its card, with the feature column sticky.

## Motion

| Moment         | Technique                                                             |
| -------------- | --------------------------------------------------------------------- |
| Hero           | Headline lines rise from masks; intro text fades                      |
| Cards          | The homepage entrance (rise, rotateX), once                           |
| Plan rail      | ScrollTrigger scrub fills the rail; each stop pops when it is reached |
| Calculator     | Odometer digits; ladder rows highlight as the slider moves            |
| Reduced motion | Final frames, no scrub                                                |
