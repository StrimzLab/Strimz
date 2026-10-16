---
date: 2026-10-15
feature: The scheduler moves merchants up a plan when their all-time volume crosses a threshold, on-chain first, then the database, then an email
scope: feat
scenario-impact: none
---

# Pricing plans, part 3 of 4: automatic upgrade

Part of #250. ADR: [ADR-2026-10-14-pricing-plans](../adr/ADR-2026-10-14-pricing-plans.md)
([plain-English version](../adr/ADR-2026-10-14-pricing-plans-for-dummies.md)), D3 (P3)
here.

## What shipped

- **A plan-upgrade cron in the scheduler, every 5 minutes (`PLAN_UPGRADE_CRON`).**
  - **Volume:** for each merchant registered on-chain and below Enterprise, it sums the
    confirmed payments in the deployment's mode: one-off, subscription, invoice and
    storefront. Refunds and pending or failed rows don't count. USDC and EURC are summed
    separately.
  - **Order:** when the volume earns a higher plan, it sends `setFeeBps` from the
    scheduler key (`FEE_MANAGER_ROLE`, part 1) and waits for a successful receipt. Then
    it moves `Merchant.tier`, writes a `merchant.plan_upgraded` audit entry and emails
    the merchant.
  - **Up only.** A Free merchant at 50,000 goes straight to Growth. Growth and
    Enterprise are never touched.
- **Failures leave the plan unchanged.** A failed fee change counts as `failed`, is
  logged with the merchant id, and is retried on the next tick. The other merchants in
  the run still move.
  - If the registry already charges the new fee (a retry after a database failure), no
    second transaction is sent.
  - The database move only applies if the plan hasn't changed since the volume was read.
  - Overlapping runs in one process don't double up.
- **Email:** "You've moved to Starter: 0.5% per transaction", with the features it
  unlocks and an Arcscan link to the fee change. A failed email doesn't undo the
  upgrade; it is logged and counted as `emailFailed`.
- **`planUpgradeFor(current, volumes)`** in `@strimz/shared-config` (minor).
- **Config:** the scheduler now requires `REGISTRY_ADDRESS`. The Lightsail env already
  sets it for the indexer.

## Operator steps

- **Deploy with the contracts redeploy (#142),** like part 2. The July registry has no
  `FEE_MANAGER_ROLE`, so a fee change from the scheduler reverts there. Each failure is
  logged and retried, and no plan changes.
- **Before the scheduler starts,** check that `REGISTRY_ADDRESS` is in its environment.

## Verification

- **Red, then green:**
  - `plan-upgrade.e2e.test.ts` (13 tests): the service did not exist on `518b06c`.
  - `chain-writes.test.ts`: 3 new tests for the fee write, the reverted receipt and the
    fee read failed.
  - `plans.test.ts`: 3 new `planUpgradeFor` tests failed.
- **Cases covered:**
  - 1,000 USDC or EURC moves Free to Starter;
  - 600 USDC plus 600 EURC does not;
  - 50,000 reaches Growth;
  - no move down, and Growth and Enterprise are left alone;
  - only confirmed payments in the deployment mode count;
  - unregistered merchants are skipped;
  - a failed fee change keeps the plan and is retried;
  - a fee the registry already holds is not sent again;
  - a failed email keeps the upgrade;
  - overlapping runs upgrade once.
- **Results:**
  - scheduler unit: 105 of 105;
  - scheduler e2e: 57 of 57;
  - `./scripts/preflight.sh` in full.
