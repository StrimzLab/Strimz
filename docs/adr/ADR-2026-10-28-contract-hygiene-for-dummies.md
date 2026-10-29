# ADR for Dummies: Small safety clean-ups before the redeploy

- **Status:** Accepted 2026-10-29
- **Date:** 2026-10-28

## The Idea

The audit found four small things in the contracts. None of them loses money today, but each one could cause a confusing mistake during a deploy or a settings change. We fix them before the redeploy.

1. **Clearer error messages.** When someone enters an empty address in a payments setting, the contract says "wrong amount". It will say "empty address" instead.
2. **Catch a broken deploy at once.** The payments contract can be deployed with an empty address for one of its parts. It would then reject every payment, and it can't be changed after deploy. The deploy will now fail straight away instead. The subscriptions contract already works this way.
3. **Same rule everywhere for swapping parts.** Payments and subscriptions only let an admin swap one of their parts while paused. The agent escrow contract will follow the same rule.
4. **Set up the merchant registry in one step.** The registry needs a second setup call after it is deployed, which was added for an older deployment. A new deploy will do everything in the first call.

## What People See

- **Payers and merchants:** nothing changes.
- **Operators:** clearer errors. To swap the escrow's token list, they pause it, make the change and unpause it, all in one approval.

## Important Limitation

- **Redeploy needed:** the payments fixes take effect only with the testnet redeploy (#142).
- **The old testnet registry stays as it is.** It is retired at the redeploy, so we don't add a way to patch it.

## What Changes

- **Payments:** clearer errors and deploy checks.
- **Agent escrow:** its token-list setting can only change while paused.
- **Merchant registry:** set up in one step.
- **Deploy script:** the extra setup call is removed.

## What Does Not Change

- How payments, subscriptions and escrow jobs work.
- Who can pause, upgrade or change settings.
- Fees, payouts and stored data.
