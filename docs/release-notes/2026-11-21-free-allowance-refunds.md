---
date: 2026-11-21
feature: Free merchants pay the 0.5% fee on chain, and Strimz refunds it on each business's first 1,000 per currency
scope: fix
scenario-impact: updated
---

# The free $1,000, without the loophole

Fixes #512. ADR: [ADR-2026-11-21-free-plan-fee-integrity](../adr/ADR-2026-11-21-free-plan-fee-integrity.md), option A.

## For merchants

- **Free merchants register at 0.5% on chain**, like Starter. Strimz refunds the fee on the business's first 1,000 in each currency to the payout wallet, within about 15 minutes.
- **One allowance per business.** Registered accounts that share a payout wallet or an owner wallet, directly or through each other, share it.
- **The dashboard shows "Fee refunded"** on each refunded payment, with an explorer link (#516). The API adds `Transaction.feeRefund`.
- **New docs page,** "Fees and your free $1,000", with a worked example. It's linked from the subscriptions guide, Transactions, Settings and the resources reference.

## Why

Switching the fee from 0% to 0.5% at the moment the allowance ran out could always be gamed: a 24-hour 0% window, bursts of checkouts, and new accounts restarting the allowance. Now the contract always takes the fee, and a refund can only return fees that were really paid, so fake accounts gain nothing.

## Under the hood

- **Database:** migration `20261121180000_fee_refunds` adds `FeeRefund` (unique per payment) and `FeeRefundTransfer` (one signed ERC-20 transfer each, stored before it's sent). It's additive.
- **Scheduler:**
  - a new `fee-refunds` cron, every 15 minutes, and a refund wallet signer;
  - the gas-balance monitor watches the refund wallet;
  - plan-upgrade volume is pooled per business;
  - the fee-drift check expects Free at 0.5%.
- **API:**
  - Free merchants register at the Starter fee;
  - checkout fee quotes use the on-chain fee;
  - a registered merchant's payout address can only change on chain (`409 payout_change_onchain`).
- **Packages (changeset):** `@strimz/shared-config` adds `onchainFeeBps` and `FREE_ALLOWANCE_UNITS`; `@strimz/shared-types` adds `Transaction.feeRefund`.
- **No contract change.**

## Rollout

1. Create the refund wallet. On testnet a software key is allowed; on mainnet use AWS KMS. Set `REFUND_*` on the scheduler; production refuses to start without it.
2. Fund it from the FeeCollector by a Safe withdrawal: a small USDC and EURC float. On Arc, USDC also pays its gas.
3. Apply the migration before the new API and scheduler start.
4. Existing testnet merchants registered at 0% stay at 0% until the redeploy, and the fee-drift monitor flags each one once. New registrations get 0.5%, and mainnet starts fresh.

## Tests

- **Red first:**
  - registration at 50 bps;
  - the checkout fee quote;
  - the fee-drift and tier-audit expectations;
  - the payout-address guard;
  - the unregistered-bridge attack;
  - the refund-wallet settings;
  - `Transaction.feeRefund`;
  - the gas monitor watching the refund wallet;
  - the alert on a failed broadcast.
- **Scheduler e2e for refunds:**
  - the pro-rata crossing payment;
  - per-currency allowances;
  - transitive linking;
  - running it many times refunds a payment once;
  - a failed broadcast is resent, never re-signed;
  - a reverted transfer is paid again with a new nonce;
  - a short wallet waits and alerts;
  - exclusions (customer refunds, refund transfers, other modes, Enterprise);
  - no wallet configured.
- **Full stack:** a real checkout payment pays 0.5% on chain, and the refund reaches the payout wallet.
