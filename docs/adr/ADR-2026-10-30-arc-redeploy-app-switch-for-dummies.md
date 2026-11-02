# Pointing the apps at the new contracts, in plain English

- **Status:** Accepted 2026-10-30
- **Date:** 2026-10-30
- **Companion to:** [ADR-2026-10-30-arc-redeploy-app-switch](ADR-2026-10-30-arc-redeploy-app-switch.md)

## What's going on

Over the last weeks we fixed every problem the October audit found in our smart contracts. Two of those contracts can't be changed once they're live, so the fixes only take effect when we deploy fresh copies (#142).

The website, the API and the background services still talk to the old contracts. If we switched them early, today's testnet would break. If we switch them late, every checkout breaks after the redeploy. So all the app-side changes go in one update, released at the same moment as the new contracts.

## What changes

- **Checkout works with the new contracts.** Payments and subscription signups send the shape of data the new contracts expect. They also work for smart-contract wallets, not just ordinary ones.
- **No hand-copied contract details.** The API reads the contract definitions straight from the contract build. If they ever drift apart, the automated checks fail.
- **No double signups.** If a payer retries a subscription signup while the first one is still going through, the contract now refuses the second one.
- **The approval stays "unlimited", and the checkout explains it.** The payer approves Strimz once. The checkout says plainly that only the amount and schedule shown can be charged, and that they can cancel at any time. A capped approval would run out on subscriptions with no end date.
- **Removed tokens.** If we stop accepting a token, its subscriptions are marked "Skipped: token not accepted" instead of failing. We also stop sending charges that can only be skipped.
- **Fee increases wait a day.** When a merchant moves up a plan, the new fee takes effect 24 hours later. The plan change and its email arrive when it does.
- **More alerts.** The team is emailed when:
  - a subscription is restored after a wrongful cancel;
  - a fee increase is scheduled or cancelled;
  - tokens are rescued from a contract.

  Merchants also get a new `subscription.reactivated` notification when one of their subscriptions comes back.

## Impact

- Checkout keeps working after the redeploy, and payers can't be signed up twice by accident.
- Developers using our SDK must add two fields when building a subscription signature. That's a breaking change, and it's noted in the package.
- Merchants may see a new kind of webhook.
- This update must not go live before the new contracts, and the new contracts must not go live without it.
