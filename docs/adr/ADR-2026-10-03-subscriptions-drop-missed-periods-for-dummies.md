# ADR for Dummies: A late subscription payment charges once, not once per missed month

- **Status:** Accepted 2026-10-03
- **Date:** 2026-10-03

## The Idea

If a subscription payment is late by several billing periods, Strimz today charges the
customer once for every period it missed, one after another. Someone six months behind
on a $50 plan is suddenly charged $300. We change the subscription contract so it
charges once, for the current period, and lets the missed periods go.

## What the Person Sees

1. A customer is on a $50 monthly plan billed on the 1st.
2. Their wallet runs dry and Strimz cannot charge them for a while.
3. In July they top up. Strimz charges $50 once, for July.
4. The next charge is on 1 August, the same billing day as before.
5. The merchant sees a note in their records that six months were skipped.

## Important Limitation

The subscription contract cannot be updated in place. The fix applies to subscriptions
created on the new contract, which Strimz deploys as part of the planned testnet
redeploy. Until then, the merchant docs warn about the old behaviour, and existing
subscriptions keep it until that redeploy moves them.

## What Changes

- Late subscriptions are charged once and stay on their usual billing day.
- Merchants can see when periods were skipped.
- The docs warn about the old behaviour until the new contract is live.

## What Does Not Change

- On-time and slightly late payments behave exactly as before.
- Prices, fees, payouts, the API and the SDK.
