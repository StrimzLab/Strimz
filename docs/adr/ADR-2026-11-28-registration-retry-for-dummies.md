# ADR for Dummies: Retry merchant on-chain registration safely

- **Status:** Accepted 2026-11-28 by the founder
- **Date:** 2026-11-28
- **Technical version:** [ADR-2026-11-28-registration-retry](ADR-2026-11-28-registration-retry.md)

## The Idea

Every merchant gets an on-chain ID when Strimz registers them on Arc. If that registration fails, Strimz should try again by itself. It should only do so when it's sure the first attempt didn't go through, because registering someone twice would give them two IDs.

## What the Person Sees

1. A merchant signs up and finishes onboarding. Strimz registers them on-chain in the background.
2. If that fails, for example because the network is down, nothing changes for the merchant. Within about 10 minutes Strimz tries again, and they're registered.
3. If it still hasn't worked after an hour, Strimz ops get an email naming the merchant and the reason.
4. Merchants never need to create a payment link just to "wake up" their registration.

## Important Limitation

- **No double registration.** Strimz won't send a second registration while the first might still land. A transaction stuck on the network makes that merchant wait, and ops are told.
- **The daily cap still applies.** A merchant who hit the registration limit waits for it to reset.

## What Changes

- **Auto-retry:** a check every 10 minutes retries stuck registrations.
- **Ops alert:** an email when a merchant is still unregistered after an hour.
- **Clean retries:** a failed attempt is cleared properly, so it can no longer block later ones (this happened on testnet).
- **Safer records:** Strimz now notes a little more about each registration attempt, so it can tell "failed" from "still on the way".

## What Does Not Change

- The smart contracts.
- Payments, subscriptions and refunds.
- How onboarding looks to merchants.
