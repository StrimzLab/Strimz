---
date: 2026-10-15
feature: One plan table from the pricing page, merchants registered at their plan fee under a 50 bps ceiling, and the storefront builder, anomaly alerts and yield recommendations limited to Starter and above
scope: feat
scenario-impact: none
---

# Pricing plans, part 2 of 4: plans, database, API and agent

Part of #250. ADR: [ADR-2026-10-14-pricing-plans](../adr/ADR-2026-10-14-pricing-plans.md)
([plain-English version](../adr/ADR-2026-10-14-pricing-plans-for-dummies.md)), D1 to D7
accepted (P1, P2, P5 on the API and agent, and P7 here). Closes #225: the subscription
premium is gone.

## What shipped

- **One plan table (`@strimz/shared-config`, minor).**
  - Free 0 bps, Starter 50 bps from 1,000 of all-time volume, Growth 40 bps from 50,000,
    Enterprise by contract. No monthly fees, no subscription premium.
  - `planForVolume` counts USDC and EURC separately, each against the thresholds in its
    own unit, and moves up when either one crosses.
  - Starter and above get the storefront builder, anomaly alerts, yield recommendations
    and priority email support.
  - Removed: `TIERS`, `getTier` and `effectiveFeeBps`.
- **Database.** `MerchantTier` is `free | starter | growth | enterprise`. The migration
  maps `growth` to `starter` and `business` to `growth`, and keeps the `free` default.
- **Registration.** A merchant registers at its plan fee with a 50 bps ceiling, using the
  five-argument `registerMerchant` from part 1. A new merchant registers at 0 bps.
- **Session and invoice fees.** The fee shown on a session or invoice is the plan fee.
  For Enterprise it is the fee the registry holds. The old fallback to 150 bps is gone:
  if the registry cannot be read, the request fails with `503 chain_unavailable`.
- **Plan limits (`403 plan_required`, `details.requiredPlan`).**
  - **Storefront builder:** creating or updating a storefront, publishing it and adding
    products. Reading and archiving still work.
  - **Agent settings:** changing anomaly-alert sensitivity, or turning on yield
    recommendations.
  - **Agent:** the anomaly and yield jobs skip merchants below Starter. The cash-flow
    digest runs on every plan.
- **Admin tier control (#128).** An admin can only move a merchant to Enterprise; the
  other plans follow volume.
  - The merchant must be registered on-chain. The audit entry records the registry fee.
  - The admin page has a "Move to Enterprise" button with a confirmation, in place of
    the four-way select.
- **Relay quotas** keep their numbers under the new names: Free 500, Starter 5,000,
  Growth 50,000, Enterprise 50,000 a day.
- **Docs.**
  - `plan_required` is in the error reference.
  - The storefront and agent API pages state the plan limits.
  - The contracts README's fee-change section covers plans and Enterprise.
  - `audit-merchant-tiers` checks fees against the plan table.

## Operator steps

- **Deploy the API with the contracts redeploy (#142), not before.** The API now sends
  the five-argument `registerMerchant`. The July contracts only have the four-argument
  one, so a registration sent to them reverts.
- **The migration** runs with `prisma migrate deploy` on the next API deploy.
- **The web deploys on merge.**
  - The settings page labels a Free merchant at 0%, while the July contracts still
    charge it 1.5%. This is true again after the redeploy.
  - The admin page sends only `enterprise`, which the July API also accepts.

## Verification

- **Red on `45b932c`, green now:**
  - `shared-config` `plans.test.ts`: 13 of 14 failed;
  - API `registration-fee.test.ts` and `audit-merchant-tiers.test.ts`: 5 failed;
  - API `plan-gating`, `plan-fees` and `merchant-tier-control` e2e: 14 failed;
  - agent `plan-limited-insights` e2e: 4 failed;
  - web `destructive-actions.test.ts`: the new Enterprise confirmation failed.
- **Changed tests:**
  - storefront-builder tests in five API suites, and the anomaly and yield tests in three
    agent suites, now seed a Starter merchant, so they keep testing what they tested;
  - the admin tier tests for hand-set Free, Growth and Business fees are replaced by the
    Enterprise-only tests.
- **Migration on Postgres 16:** every migration applied, then this one, over rows at
  `free`, `growth`, `business` and `enterprise`. They became `free`, `starter`, `growth`
  and `enterprise`, the default stayed `'free'`, and `prisma migrate diff` against the
  schema reports no difference.
- **Results:**
  - API e2e: 336 of 336;
  - agent e2e: 51 of 51;
  - `./scripts/preflight.sh` in full.
