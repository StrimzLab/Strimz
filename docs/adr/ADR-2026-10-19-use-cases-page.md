# ADR: Replace Customers with an honest Use cases page

- **Status:** Accepted (maintainer approved 2026-10-19)
- **Date:** 2026-10-19
- **Issue:** #281 (part of #286)
- **Plan:** `docs/plans/2026-10-19-use-cases-plan.md`

## Context

`/customers` is titled "Customers" but has no customers. #154 removed the invented logos and metrics, which left:

- a hero;
- a testimonials block that renders only when a quote has a name, role and company (none do);
- a call to action with old flat buttons and "Talk to sales", which points at a sales inbox that no longer exists (support@ is the single inbox).

Strimz is pre-launch. The issue asks to turn the page into use cases, one per audience, each with:

- the problem;
- how Strimz handles it;
- a mini product illustration;
- an indicative cost example.

It also asks for a slot for real case studies, and for the nav to be renamed.

The issue also suggests a "before / after" (bank wires and emailed invoices against Strimz). The maintainer has since ruled out comparisons with other payment methods, so that recipe is dropped. Each section shows only what Strimz does.

## Decision

### D1. Route and navigation

- **The page moves to `/use-cases`.** `next.config` gets a permanent redirect from `/customers`, so old links keep working.
- **The nav and footer** say "Use cases".
- **Metadata** is rewritten to match.

### D2. Page structure

1. **Hero.** "Built for businesses that bill online." A sticky row of audience chips (SaaS, Marketplaces, Creators, Agencies, Global B2B) jumps to each section and highlights the one in view.
2. **Five use-case sections,** alternating sides. Each section has:
   - **the job**, in the owner's words, with no comparison;
   - **how Strimz handles it:** three features, each linking to the guide that documents it;
   - **a mini product illustration:**
     - SaaS reuses `SubscriptionsMock`;
     - Agencies reuse `InvoicesMock`;
     - Global B2B reuses the payment-link scene;
     - Marketplaces get a new `OrderMock` (order paid → signed webhook → order updated);
     - Creators get a new `StorefrontMock`;
   - **a sample cost:** a stated monthly volume, run through `firstYearFees`, showing first-year fees and the effective rate. It is labelled "Sample". The Global B2B example is in EURC.
3. **Case studies slot.** It is data-driven, as now, and renders only when an entry has a real name, role and company. Until then nothing shows and nothing is claimed.
4. **The shared closing panel.**

### D3. What each section claims

Only features documented in `content/docs`:

| Audience     | Features shown                                                                               | Sources                                                                 |
| ------------ | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| SaaS         | Subscriptions with trials; failed-charge recovery; self-serve cancel                         | guides/subscriptions, subscriptions/recovery, recipes/self-serve-cancel |
| Marketplaces | A checkout per order; signed webhooks; full or partial refunds                               | guides/accept-payment, guides/webhooks, guides/refunds                  |
| Creators     | A no-code storefront (Starter); memberships as subscriptions; payment links                  | guides/storefronts, guides/subscriptions, recipes/invoice-link          |
| Agencies     | Invoices emailed with a Pay button; numbered invoices with a PDF; retainers as subscriptions | guides/invoices, guides/subscriptions                                   |
| Global B2B   | USDC or EURC; non-custodial settlement on Arc; customers pay no gas                          | subscriptions/plans, concepts/meta-tx-flow, checkout/hosted             |

The Marketplaces section states one limit plainly: payments settle to your wallet, and Strimz does not split payouts to sellers.

### D4. Motion and states

- **Motion:** each section enters once with GSAP (`PLAY_ONCE`). The chips track the section in view with an `IntersectionObserver`. Reduced motion shows final frames.
- **States:** each section is wrapped in `SectionBoundary`.
- **Buttons:** `PopLink` keycaps.
  - The call to action is "Start free" to `/signup`, with "Talk to us" to `/contact`.
  - "Talk to sales" goes.

### D5. Tests

- **next-config:** `/customers` redirects permanently to `/use-cases`.
- **Use-case data:**
  - every feature link resolves to an existing docs page (via the docs-links test);
  - every sample cost comes from `firstYearFees` and is labelled "Sample";
  - each of the five audiences appears once.
- **Marketing honesty:** the no-comparison guard extends to `components/marketing/use-cases/` and the page. No invented customer names: case studies render only when named.
- **Navigation:** nav and footer link to `/use-cases`, and nothing links to `/customers`.

```
app/(marketing)/use-cases/page.tsx
  ├── UseCasesHero (chips → #saas … #global-b2b)
  ├── UseCaseSection × 5  ← USE_CASES (data: job, features+docs, mock, sample volume)
  │       └── mocks: SubscriptionsMock | OrderMock | StorefrontMock | InvoicesMock | ShareScene
  │       └── sample cost: firstYearFees(volume)  (lib/fee-estimate)
  ├── CaseStudies (renders only named entries)
  └── Closing
next.config: redirect /customers → /use-cases (308)
```

## Consequences

- The page tells a business owner how Strimz fits their model without claiming customers it doesn't have.
- The URL changes. The redirect keeps external links working, and nothing in the app links to `/customers` any more.
- When real case studies exist, adding a named entry makes the slot appear without a code change to the layout.

## Alternatives considered

- **Keep `/customers` with use-case content.** The URL would promise customer stories. Rejected.
- **Before / after comparisons.** Ruled out by the maintainer.
- **A separate page per audience.** More to maintain, and not needed yet. One page with anchors is enough.

## Verification

- New tests go red, then green.
- `./scripts/preflight.sh` passes in full.
- Chrome on `/use-cases` at 1440, 768 and 390, in light and dark, and with reduced motion:
  - the chips scroll to and highlight sections;
  - no overflow;
  - nothing hidden;
  - `/customers` redirects.
- Sweep the other marketing pages for the nav change.
