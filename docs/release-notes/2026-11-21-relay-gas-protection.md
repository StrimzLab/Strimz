---
date: 2026-11-21
feature: Relayer gas can't be drained, and a payer can always pay the network fee themselves
scope: feature
scenario-impact: updated
---

# Relayer gas protection

Closes #510. ADR: [ADR-2026-11-21-relay-gas-protection](../adr/ADR-2026-11-21-relay-gas-protection.md). UI: #520 (checkout), #521 (admin).

## For payers

- **When Strimz can't cover the network fee, checkout says so and offers a button to pay it from your wallet.** It shows the fee, about 0.004 USDC on testnet. You don't approve the payment again. This applies to payments, subscription signups, allowance renewals and cancels.

## For merchants

- **`402 relay_unavailable` replaces `429 relay_budget_exhausted`** on the relay routes. `error.details.call` is the payer-signed transaction, and `error.details.reason` says why. See "When Strimz doesn't pay the gas" in the API reference. If you call `/v1/relay` directly, handle the 402 by letting the payer's wallet send `call`.
- **A new Free merchant starts at 50 relayed calls a day.** The full 500 opens automatically with the first confirmed payment or charge of at least 1.00. Strimz support can open it earlier.
- **A call that reverts on-chain no longer uses up your quota.**

## For operators

- **New settings:** `RELAY_PLATFORM_DAILY_CAP` (default 50,000), `RELAYER_MIN_BALANCE_USDC` (default 2) and `REGISTRATION_DAILY_CAP` (default 200). Each has a default, so nothing has to be set.
- **New runbook:** `docs/runbooks/relayer-gas.md`. It has the measured testnet costs and what to do for each alert.
- **Migration** `20261121200000_relay_unlock` adds `Merchant.relayUnlockedAt`. Run it before the new API starts.
- **The relay job payload gains two optional fields,** `payer` and `clientKey`. Jobs already in the queue still parse.

## Why

Strimz pays the gas for relayed calls, so a flood of junk calls could drain the relayer. Each limit now bounds a different way of doing that:

- a platform ceiling and a balance floor;
- a lower quota until a merchant is real;
- caps per payer and per network on signups;
- a cut-off for wallets whose calls keep reverting.

None of them can stop an honest payment, because the payer can always send it themselves.

## Tests

- **API:**
  - `relay-gas-protection.e2e.test.ts`, with 22 tests across the ceiling, the floor, the quota fallback, the signup caps, reverts, the registration cap and the starter quota;
  - a revert test in `relay-job-runner.e2e`;
  - updated quota tests in `relay-abuse.e2e`.
- **Checkout:** `self-pay.test.ts`, plus self-pay cases in `manage-subscriptions.test.ts`.
