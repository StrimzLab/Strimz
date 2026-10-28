# ADR for Dummies: Send back tokens sent to our contracts by mistake

- **Status:** Accepted 2026-10-28
- **Date:** 2026-10-28

## The Idea

Someone can send USDC straight to the address of one of our payment contracts, for example by pasting it into their wallet's "Send" screen instead of paying a checkout. Today those tokens are stuck for good, because the contracts have no way to move them out.

We add a "return" button only the Strimz Safe can press. It sends those stray tokens back to whoever sent them.

## What the Person Sees

1. Someone sends USDC to a Strimz contract address by mistake and contacts support.
2. Strimz checks the transfer on the explorer and returns it from the Safe.
3. The person gets their USDC back. The return is public on the blockchain, and the Strimz team gets an alert.

## Important Limitation

- **It can't touch merchant money or Strimz fees.** Payments go straight to the merchant's payout address, and fees go to a separate fee contract, in the same transaction. These two contracts never keep money. Tests check this after every payment and charge.
- **Redeploy needed:** the contracts can't be changed in place, so this takes effect with the testnet redeploy (#142). Anything sent to the old contracts stays stuck.
- **It's manual:** someone has to notice or report the mistake, and the Safe has to approve the return.

## What Changes

- **Contracts:** a return function only the Safe or the timelock can call. It works even while payments are paused.
- **At the redeploy:** the admin alerts include every return.

## What Does Not Change

- How payments and subscriptions work, and where money goes.
- Who can pause, upgrade or change settings.
- Fees and merchant payouts.
