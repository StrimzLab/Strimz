# ADR for Dummies: Contract fixes before mainnet

- **Status:** Accepted 2026-11-20
- **Date:** 2026-11-19

## The Idea

The 2026-11-19 security audit found four problems in contracts that will go to mainnet. Mainnet isn't live yet, so we fix them now, while that is cheap.

1. **Old signups could be used late.** A subscription signup has an expiry time, but the contract never checked it. If a payer had already approved Strimz, someone could submit an old signup weeks later and start charging. Now an expired signup is refused.
2. **A signup didn't name the wallet.** For some smart wallets, one signup could be reused to enrol a second wallet owned by the same person. The signup now names the paying wallet.
3. **Selling a merchant account could leave the old owner's payout in place.** The seller could switch the payout wallet while the sale was pending, so the buyer's revenue went to the seller. Now payout changes are frozen while a sale is pending, and starting a sale cancels any pending change.
4. **A payer couldn't say "I've left" after an operator cancelled them.** That left the door open for an admin to restart their billing. Now the payer's cancel is recorded, and a restart is blocked.

We also use the same new contract for two things that need it:

5. **The signup records which plan it was for** (#497). Today Strimz guesses the plan from the price, and can guess wrong when two plans cost the same.
6. **A subscriber can cancel without paying gas** (#499). They sign a "cancel" message and Strimz submits it. It counts as their own cancel, so nobody can restart it.

## What the Person Sees

- **Payers:** nothing new. Checkout asks for the same two signatures.
- **Merchants selling their account:** a payout change has to wait until the sale finishes or is cancelled.
- **Developers who build their own signup screen:** update `@strimz/sdk` when we switch contracts.

## Important Limitation

- **The subscription contract can't be edited in place.** Testnet gets a new subscription contract. Testers' test subscriptions on the old one stop renewing, and they subscribe again. Mainnet starts on the fixed contract.
- **The fee ceiling isn't changing.** It stays at 5%. The docs now say fees may rise, for example with network costs, but never above 5%, and any rise waits 24 hours.

## What Changes

- The subscription and registry contracts, the SDK's signup message, checkout, and the docs.

## What Does Not Change

- One-off payments, fees, renewals, retries, and how merchants get paid.
