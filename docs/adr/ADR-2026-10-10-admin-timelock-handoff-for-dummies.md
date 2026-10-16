# ADR for Dummies: No single key controls Strimz's contracts

- **Status:** Accepted
- **Date:** 2026-10-10

## The Idea

Strimz's smart contracts hold the rules for who gets paid and how much Strimz keeps.
Today one key, the one that deployed them, can do everything: change the code, point
payments at a different contract, take the collected fees, settle disputes and charge
subscriptions. If that one key leaks, an attacker owns the whole system, and they can do
it in a single block with no warning.

We split those powers three ways:

1. **Slow and public:** changing code, re-pointing contracts and adding tokens go through
   a timelock. The change is announced on-chain and can only run after a waiting period
   (recommended: 48 hours on mainnet). Anyone watching sees it coming.
2. **Fast but shared:** pausing in an emergency, unpausing, setting a merchant's fee,
   switching a merchant off, withdrawing fees and settling disputes need a Safe
   multisig: two of three people approve each transaction.
3. **Narrow service keys:** the API's key can only register merchants; the scheduler's
   key can only charge subscriptions that are due. They must be different keys, and the
   Safe can switch either off at once.

The deploying key gives up every power at the end. A small script does the handoff and
checks the result, and a test proves it works before it runs on the real chain.

## What the Person Sees

- Merchants and payers: nothing changes.
- Admins: changing a merchant's on-chain fee becomes a Safe transaction that two people
  approve. The admin page says so.
- Anyone can see an upgrade or contract switch announced on-chain before it happens.

## Important Limitation

The two payment contracts can't be changed after deployment, so on testnet they are
deployed again at new addresses, and existing testnet subscriptions stop renewing.
Mainnet starts fresh, so nothing is lost there.

## Choices for the maintainer

- **H1.** Who does what (the split above, recommended), or also put fee changes behind
  the waiting period.
- **H2.** Waiting period: 48 hours on mainnet, 5 minutes on testnet (recommended).
- **H3.** The Safe: 2 of 3 signers on hardware wallets (recommended). You create it.
- **H4.** An extra offline "panic button" key that can only pause (recommended), or none.
- **H5.** Anyone can trigger an approved change once the wait is over (recommended), or
  only the Safe.
- **H6.** On testnet, keep merchants and redeploy only the payment contracts
  (recommended), or start testnet completely fresh.
- **H7.** The Safe can switch off a leaked service key at once (recommended), or only
  through the waiting period.

## Impact

- Contracts change and are redeployed (testnet) or deployed fresh (mainnet).
- New contract addresses go into the Lightsail and Vercel settings on testnet.
- You need a Safe and, optionally, a guardian key before the handoff runs.
