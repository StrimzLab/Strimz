# ADR for Dummies: Agent reports keep dollars and euros apart

- **Status:** Accepted 2026-10-04
- **Amended:** 2026-10-06: option (a) and the decision 7 scope, approved by the maintainer.
- **Date:** 2026-10-04

## The Idea

Merchants can be paid in USDC (a digital dollar) or EURC (a digital euro). The AutoPay
Agent's emails and activity feed add the two together and call the result "USDC", so
100 dollars plus 50 euros is reported as 150 dollars. We propose to report each currency
on its own, as the dashboard has done since the last release.

## What the Person Sees

1. The daily digest shows dollars and euros on separate lines.
2. A revenue drop alert names the currency that dropped. If both dropped, two alerts
   arrive.
3. The "move your surplus to yield" suggestion only looks at dollars, because the
   merchant's reserve is set in dollars. Euros are shown, not counted.
4. The monthly commerce summary lists spending per currency. The monthly spending cap,
   set in dollars, only counts dollar spending.
5. The monthly pricing email shows recurring revenue and the forecast per currency.
6. Test payments, test subscriptions and test refunds no longer appear in these reports.
   Commerce jobs are the exception: Strimz does not record whether a job was a test, so
   the commerce summary still counts every job.

## Important Limitation

There is no exchange rate in Strimz. Caps and reserves stay in dollars, so euro spending
is never capped and euro balances never trigger a yield suggestion. Adding euro caps
needs a new setting and is a separate decision.

## What Changes

- Emails from the digest, anomaly alert, yield suggestion, commerce summary and pricing
  report.
- The details attached to those entries in the agent activity feed: each amount becomes
  two fields, one for dollars and one for euros (for example `revenueUsdc` and
  `revenueEurc`). They stay simple values, so the Strimz SDK and existing integrations
  keep reading the feed without errors.
- Test-mode payments and refunds stop counting as revenue in agent reports.

## What Does Not Change

- No money moves differently. The agent still only reports and suggests.
- Smart contracts, payments, subscriptions, webhooks and the dashboard.
- Older activity entries keep the shape they were written with.
