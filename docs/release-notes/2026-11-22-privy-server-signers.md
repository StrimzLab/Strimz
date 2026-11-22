---
date: 2026-11-22
feature: Mainnet signing keys live in Privy server wallets, limited to Strimz's own calls
scope: feature
scenario-impact: updated
---

# Mainnet signers on Privy server wallets

ADR: [ADR-2026-11-22-privy-server-signers](../adr/ADR-2026-11-22-privy-server-signers.md). Closes #455. Runbook: [privy-signers.md](../runbooks/privy-signers.md).

## What changed

- **The keys stay out of the server.** On mainnet the relayer, the scheduler and the refund wallet each sign through a Privy server wallet. The server holds only a Privy key that can ask for signatures.
- **The rules decide what gets signed.** Privy signs only what each wallet's rules allow. Every allowed call must attach no value.
  - relayer: payments, subscriptions, payer cancels, merchant registration and USDC allowance renewals;
  - scheduler: charges, cancels and fee changes;
  - refund wallet: USDC or EURC transfers of 5 tokens or less.
- **Changing the rules needs the owner key,** which never sits on the server.
- **Mainnet production refuses any other signer.** Testnet keeps its plain keys.
- **The signed transaction is checked before it is sent.** If what Privy returns isn't exactly the transaction that was asked for, from the expected address, nothing is broadcast.
- **A rule refusal is a security alert.**
  - The job stops and is not retried.
  - Its nonce is freed, so later transactions don't stall.
  - Ops get an email.
- **A Privy outage is retried like any network error.** Checkout falls back to payer-sent transactions.
- **The scheduler frees a nonce whenever a send fails before broadcast,** whatever the signer. Before this, a failed send could leave a nonce gap.
- **Signatures are counted per month,** and ops are warned at 40,000. Privy's free plan covers 50,000.

## Settings

- **API:** `KMS_PROVIDER=privy`, `PRIVY_RELAYER_WALLET_ID`, `KMS_SIGNER_ADDRESS`, `PRIVY_SIGNER_AUTHORIZATION_KEY`.
- **Scheduler:**
  - `SCHEDULER_SIGNER_PROVIDER=privy` and `REFUND_SIGNER_PROVIDER=privy`;
  - `PRIVY_SCHEDULER_WALLET_ID`, `PRIVY_REFUND_WALLET_ID`;
  - `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_SIGNER_AUTHORIZATION_KEY`.
- **Mainnet relay cap:** set `RELAY_PLATFORM_DAILY_CAP=1500`.

## Tests

- **Signer package:**
  - Privy signs whole transactions;
  - a wrong wallet address stops boot;
  - a mismatched signed transaction is refused;
  - messages and typed data are never signed;
  - a policy refusal is its own error and is not retried;
  - the rule definitions and the monthly signature count are covered.
- **API:**
  - provider selection: Privy on mainnet, other signers refused there;
  - relaying with a Privy wallet: success, policy refusal (permanent, nonce freed, ops alerted) and outage (retried, nonce freed);
  - the relayer rules match the relay's real ABIs.
- **Scheduler:**
  - Privy settings and validation;
  - each signer connects to its own wallet;
  - the policy-refusal alert;
  - the nonce reset;
  - the scheduler and refund rules match the real ABIs.
- **Against Privy's real engine:** all 22 rule checks passed on an unfunded test wallet with testnet addresses. Nothing was broadcast, and the temporary rules were deleted.
