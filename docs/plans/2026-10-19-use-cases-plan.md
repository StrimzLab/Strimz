# Use cases page plan (#281)

## Brief

- **The reader:** a business owner asking "does this fit how I bill?"
- **Rules:**
  - No invented customers, logos, quotes or metrics.
  - No comparisons with cards or other payment methods.
  - Every feature named links to its guide.
  - Every number is a labelled sample run through `firstYearFees`.

## Wireframe (desktop 1440)

```
┌ glass nav … About  Pricing  Use cases  Docs  Contact ──────────────────────────────┐
 ● Use cases
 Built for businesses
 that bill online.                         (Sora, line-mask intro)
 One account for subscriptions, payment links, invoices and storefronts…
 [SaaS] [Marketplaces] [Creators] [Agencies] [Global B2B]   ← sticky chip bar, lit on scroll
 ── #saas ───────────────────────────────────────────────────────────────────────────
 SaaS                                            ┌ SubscriptionsMock ─────────┐
 Charge every month without asking every month.  │                            │
 ✓ Subscriptions with free trials  → guide       └────────────────────────────┘
 ✓ Failed-charge recovery          → guide       Sample: 200 customers × $49/month
 ✓ Self-serve cancel               → recipe      = $9,800 a month · first-year fees $X (Y%)
 ── #marketplaces (mock left, copy right) ── OrderMock ──
 ── #creators ── StorefrontMock ──
 ── #agencies ── InvoicesMock ──
 ── #global-b2b ── payment link scene (EURC) ──
 [Case studies — only when named entries exist]
 ═══ shared navy Closing ═══
```

## Phone (390)

- The chip bar scrolls sideways under the nav.
- Each section stacks: copy, then mock, then sample.

## Samples (all labelled "Sample")

| Audience     | Volume                                    |
| ------------ | ----------------------------------------- |
| SaaS         | 200 customers × 49 USDC = 9,800 a month   |
| Marketplaces | 400 orders × 60 USDC = 24,000 a month     |
| Creators     | 500 members × 8 USDC = 4,000 a month      |
| Agencies     | 4 retainers × 3,000 EURC = 12,000 a month |
| Global B2B   | 3 invoices × 8,000 EURC = 24,000 a month  |
