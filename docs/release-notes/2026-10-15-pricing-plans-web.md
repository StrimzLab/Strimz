---
date: 2026-10-15
feature: The pricing page and home-page teaser show the real plans, and the dashboard shows each merchant's plan, its next automatic step and which sections unlock at Starter
scope: feat
scenario-impact: none
---

# Pricing plans, part 4 of 4: pricing page and dashboard

Part of #250, and the last part. Closes #224. ADR:
[ADR-2026-10-14-pricing-plans](../adr/ADR-2026-10-14-pricing-plans.md)
([plain-English version](../adr/ADR-2026-10-14-pricing-plans-for-dummies.md)), P5 in the
dashboard and P6 here.

## What shipped

- **One plan module for the web (`apps/web/src/lib/pricing-plans.ts`),** built from the
  shared plan table. The pricing page and the home-page teaser both read it.
  - Free 0%, first $1,000 processed; Starter 0.5% from $1,000; Growth 0.4% from $50,000;
    Enterprise by contract above $1M. No monthly caps.
  - **Buttons:** "Start free", "Start with Starter" and "Start with Growth" go to `/login`;
    Enterprise "Contact us" goes to `/contact`.
  - **Features list only what exists.** Removed: custom domains, "any USDC chain",
    webhook-event quotas, the Slack channel, the uptime SLAs, the solutions engineer and
    custom legal terms. Priority email support stays, on Starter and above (D6).
  - The page says every merchant starts on Free and moves up automatically, never back,
    with volume counted per currency.
- **Dashboard.**
  - **Storefront:** below Starter the page shows "The storefront builder starts on
    Starter. Unlocks automatically at $1,000 processed." instead of the builder.
  - **Cashflow settings:** below Starter the dialog keeps the digest switch and shows the
    same notice in place of anomaly sensitivity and the yield controls. It only sends the
    settings the plan allows.
  - **Settings:** the plan name, its fee and the next automatic step, for example "Moves
    to Starter (0.5%) automatically at $1,000 processed." The fees card no longer says
    support changes the tier.
- **Admin.** The tier refusal handling only reads `merchant_not_registered`. The
  fee-mismatch codes it also handled are no longer sent by the API (part 2).
- **Copy elsewhere.**
  - The contact page offers priority email support in place of a Slack channel.
  - The docs no longer promise custom domains on Growth or uptime SLAs.
  - The storefront and agent dashboard pages state the Starter requirement.

## Operator steps

None. The web deploys on merge. Until the contracts redeploy (#142), the July contracts
still charge 1.5%, while the page and the dashboard show the new plans.

## Verification

- **Red, then green:**
  - `pricing-plans.test.ts`: the module did not exist on `f72ebb0`, and the two pages did
    not read it.
  - `dashboard-plan-locks.test.ts`: 3 failed.
  - `tier-refusal.test.ts`: 2 failed.
- **Results:**
  - web tests: 326 of 326;
  - `./scripts/preflight.sh` in full, including the production build.
