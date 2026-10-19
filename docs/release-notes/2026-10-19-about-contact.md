---
date: 2026-10-19
feature: About and Contact pages rebuilt with sourced trust claims and a single inbox
scope: feat
scenario-impact: none
---

# About and Contact pages a business can trust

Closes #282. Part of #286.

- **ADR:** `docs/adr/ADR-2026-10-19-about-contact.md` and its for-dummies companion.

## What shipped

- **About:**
  - mission;
  - why stablecoins work for business (paid in seconds, final once settled, customers anywhere);
  - how we keep your money safe (non-custodial, on-chain receipts, privately audited contracts);
  - a facts band (Arc, 2 stablecoins, 0 gas for customers, 0 funds held);
  - the shared closing panel.

  The card comparisons are gone.

- **Contact:**
  - one inbox card for support@strimz.finance, with Sales, Support and Security subject links and a "Book a demo" email;
  - the existing form;
  - priority support from the plan config;
  - office hours.

  The three duplicate inbox cards and their duplicate-key error are gone.

- **Shared pieces:** `PageHero`, `RiseIn` and `lib/contact-topics.ts`.
- **Guards:**
  - the no-comparison check covers About and Contact;
  - "are audited" is replaced by a rule that bans implying a public or third-party audit report.

## Before launch

- The privately audited claim rests on the maintainer. Link the report if it is published.
- #321 rewrites the contact form's validation messages.

## Operator steps

None. Web only; it deploys with the next Vercel build.
