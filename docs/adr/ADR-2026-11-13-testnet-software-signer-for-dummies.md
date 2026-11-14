# ADR for Dummies: Let the testnet server use its own signing keys

- **Status:** Accepted 2026-11-13
- **Date:** 2026-11-13

## The Idea

Two parts of Strimz send blockchain transactions by themselves: the relayer, which registers merchants and submits checkouts, and the scheduler, which charges subscriptions. For safety, the live server was only allowed to sign through Amazon's key service. Our Amazon account is suspended, so the server can't start.

This change lets the server keep those two keys in its own settings file, but only on testnet, where the money is test money. On mainnet the old rule stays: it refuses to start until we pick a proper key service.

## What the Person Sees

1. Strimz runs again on the new OVH server, on testnet.
2. Checkouts, subscriptions and charges work as before, using the same two wallets that already have permission on the testnet contracts.
3. If someone tries to run mainnet this way, the server refuses to start and says why.

## Important Limitation

On testnet, anyone who broke into the server could use those two keys. They only hold test money, and we can replace them if that happens. Mainnet needs a safer key service first, which is tracked separately.

## What Changes

- The testnet server can sign with keys kept in its private settings file.
- A warning in the logs says so each time it starts.

## What Does Not Change

- Mainnet still requires a dedicated key service.
- The contracts, permissions and payment flows.
