---
date: 2026-10-16
feature: A Plans page with New plan, Archive and a plan page with its sign-up link and subscribers, plus a subscription page with its charges and Cancel
scope: feat
scenario-impact: none
---

# Dashboard, part 3 of 3: plans and subscriptions

Finishes #149. ADR:
[ADR-2026-10-16-dashboard-plans-sessions-transactions](../adr/ADR-2026-10-16-dashboard-plans-sessions-transactions.md)
([plain-English version](../adr/ADR-2026-10-16-dashboard-plans-sessions-transactions-for-dummies.md)).

## What shipped

- **Plans page** at `/app/plans`, in the sidebar under Payments.
  - **Filters:** active, archived or all.
  - **Rows:** price per interval and trial.
  - **New plan:** a dialog for name, price, currency, interval, "bill every", trial and
    description. `buildPlanInput` applies the 1.00 minimum, 1-365 for the interval count
    and 0-365 trial days.
- **Plan page:**
  - price, billing, trial and description;
  - the `/sub/<id>` sign-up link with a copy button;
  - the plan's subscribers (through the existing `planId` filter);
  - **Archive**, with a confirmation that existing subscribers keep being charged and the
    link stops taking sign-ups.
- **Subscription page:**
  - plan, payer, trial, current period and next charge;
  - its charges (through part 1's `subscriptionId` filter), each linking to its
    transaction;
  - **Cancel** for active, trialing and at-risk subscriptions, as on the list.
- **Subscriptions list:** shows plan names and links each row to the subscription and the
  plan.
- **Storefront:** the product dialog's "no plans" hint links to the Plans page.
- **Archive cache:** archiving now also updates paginated plan lists.
- **Docs:**
  - new `dashboard/plans` page;
  - `dashboard/subscriptions` is rewritten. The Plans/Subscribers tabs, a Pause button and
    a "Re-authorise" link never existed.

## Operator steps

None.

## Verification

- **Red, then green:**
  - `plan-input.test.ts` and `plans-view.test.ts`: the modules did not exist;
  - `destructive-actions.test.ts`: the new archive confirmation failed;
  - `dashboard-plans.test.ts`: 8 failed.
- **Results:**
  - web: 441 of 441;
  - `./scripts/preflight.sh` in full.
