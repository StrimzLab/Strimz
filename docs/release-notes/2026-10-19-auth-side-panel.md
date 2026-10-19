---
date: 2026-10-19
feature: Business-facing sign-in and sign-up side panel
scope: feat
scenario-impact: none
---

# A sign-up panel that speaks to business owners

Closes #283. Part of #286.

- **ADR:** `docs/adr/ADR-2026-10-19-auth-side-panel.md` and its for-dummies companion.

## What shipped

- **Sign-up and onboarding:**
  - "Get paid in USDC and EURC, straight to your wallet.";
  - three benefits (paid in seconds, into your own wallet, free to start: 0% on your first $1,000, from `PLANS`);
  - a "Payment received" card tagged Sample.
- **Sign-in and callback:** "Welcome back." with a "This month" card tagged Sample.
- **Bottom line:** "Settled in USDC and EURC" replaces "Live on Arc". The panel is now a full-height sticky column, so the line is never cut off.
- **Phones:** sign-up shows the three benefits as a slim row above the form, and the form stays in the first screen.
- **Removed:** "next billion", "infrastructure" and "One API".

## Operator steps

None. Web only; it deploys with the next Vercel build.
