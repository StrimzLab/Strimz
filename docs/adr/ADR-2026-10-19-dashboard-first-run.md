# ADR: No-code first run and plain-language labels in the dashboard

- **Status:** Accepted (maintainer approved 2026-10-19)
- **Date:** 2026-10-19
- **Issue:** #284 (part of #286)

## Context

The dashboard home shows a first-run checklist until the first confirmed payment:

1. Issue your first API key.
2. Send a test payment.
3. Wire a webhook.

A business owner who doesn't write code has no path through it. That's unnecessary, because the dashboard already does the no-code job:

- **`NewPaymentSessionDialog`** creates a one-time payment and shows its `checkoutUrl` to copy. It goes through `useMerchantApi`, the merchant's dashboard sign-in, not an API key.
- **`NewPlanDialog`** creates a subscription plan with a sign-up link.
- **`/app/invoices/new`** creates an invoice that is emailed with a Pay button.

The labels are internal terms. The sidebar says "Sessions" for payment links, and the "Buyers" group holds Customers and Storefront.

The list pages' empty states are terse ("No sessions") and offer no action beyond, in two places, "Click New …".

The home KPI cards use internal shorthand ("MRR", "Customers cycling"), and the 30-day chart has no empty state.

## Decision

### D1. A "Get paid" first-run card on the home page

- **When it shows:** the same rule as today, until the first confirmed payment (`cards.anyConfirmedAtAll`).
- **Two tabs, "No code" first:**
  - **No code:**
    1. **Create a payment link or a plan.** Opens the new-payment dialog through `/app/payment-sessions?new=1`, with a secondary link to Plans.
    2. **Share the link.** Copy it from the dialog and open it to pay in test mode.
    3. **See the payment land.** Links to Transactions.
  - **With your developer:** API key → test payment → webhook, the current three steps.
- **Each step shows done or not done,** from data the page already loads or one count query:
  - **created:** any payment session or plan exists;
  - **paid:** `anyConfirmedAtAll`.
  - "Share" counts as done once paid.
- **No step on the no-code path links to `/app/api-keys`.** A test locks this.
- **`firstRunSteps(progress)`** is a pure function in `lib/first-run.ts`, so it can be tested.

### D2. Plain labels; URLs unchanged

- **Renames:**
  - "Sessions" → **"Payment links"** in the sidebar, the page header, the description and the empty state;
  - the sidebar group "Buyers" → **"Customers"**.
- **URLs stay the same** (`/app/payment-sessions`, `/app/customers`), so nothing needs redirecting and every route keeps working.

### D3. Empty states that explain the outcome

- **`DataTable` gains an `emptyAction` slot.** The copy lives in `lib/empty-states.ts` for seven pages:
  - Payment links;
  - Plans;
  - Subscriptions;
  - Invoices;
  - Customers;
  - Transactions;
  - Refunds.
- **Each empty state says what will appear and why it matters,** and offers the no-code action first. For example, Subscriptions: "When a customer approves a plan, their subscription appears here and renews on its own." Its action is "Create a plan".
- **Developer pages are out of scope:** Webhooks, API keys and Agent keep their current empty states.

### D4. Home cards in plain language

- **"MRR"** becomes **"Monthly recurring revenue"**. The helper lines say what each number means:
  - "From active subscriptions";
  - "Paying you every period";
  - "Confirmed in the last 7 days";
  - "Sent and not yet paid".
- **The 30-day chart gets an empty state** when there is no volume: a Solar icon, "Your first payment will show here", and a "Create a payment link" action.
- **KPI values count up once on first load** with the existing `Odometer` digits. Reduced motion shows the final value.

### D5. Tests

- **`first-run.test.ts`:**
  - the no-code path comes first;
  - no no-code step links to `/app/api-keys`;
  - the developer path keeps API key → test payment → webhook;
  - steps are marked done from progress.
- **`dashboard-labels.test.ts`:**
  - the sidebar shows "Payment links" and a "Customers" group, and every href is unchanged;
  - `/app/payment-sessions?new=1` opens the dialog, through `shouldOpenNew(searchParams)`.
- **`empty-states.test.ts`:** every listed page has a title, an outcome description, and an action whose href goes nowhere near `/app/api-keys`.

```
app/(dashboard)/app/page.tsx ── <FirstRunCard steps=firstRunSteps(progress)/>  (until first paid)
                              ├ KpiCard × 4 (plain labels, Odometer count-up)
                              └ 30-day chart | <ChartEmpty/>
sidebar.tsx ── "Payment links" (/app/payment-sessions), group "Customers"
payment-sessions/page.tsx ── ?new=1 → NewPaymentSessionDialog open
DataTable.emptyAction ← lib/empty-states.ts (7 pages)
```

## Consequences

- A merchant can create a payment link, pay it in test mode and see it land without touching API keys or code.
- The labels match the marketing site's words: payment link, customers.
- The developer path stays one tab away.
- `DataTable` gains an optional prop. Existing callers are unchanged.

## Alternatives considered

- **Rename the URLs to `/app/payment-links`.** Old links would need redirects, and nothing would gain from it. Rejected.
- **"Checkouts" instead of "Payment links".** The homepage, use cases and docs already say "payment link".
- **A guided modal tour for first run.** There is already a dashboard tour. A visible checklist is clearer and doesn't interrupt.

## Verification

- New tests go red, then green. Existing dashboard tests still pass.
- `./scripts/preflight.sh` passes in full.
- **Chrome, signed in on testnet:**
  - the home first-run card;
  - create a payment link from step 1;
  - copy it, open it and pay with testnet USDC;
  - see it land on Transactions and on the home card.
  - **Record the transaction hash.**
- Empty states on a fresh merchant, in light and dark, at desktop and phone sizes.
