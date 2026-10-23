# ADR for Dummies: Let Safe and other smart wallets pay

- **Status:** Accepted 2026-10-23
- **Date:** 2026-10-23

## The Idea

Some people keep their money in a "smart wallet", such as a Safe. These wallets are programs rather than a single key. Today Strimz can only read a signature from a single key. A smart-wallet user who opens a checkout is told "Smart-contract wallets cannot pay here yet", or on the subscribe page the payment just fails.

We change the Strimz contracts so they ask a smart wallet "did you approve this?" in the standard way (ERC-1271). USDC and EURC on Arc already support this. I confirmed it with a test against the real testnet tokens.

## What the Person Sees

1. A Safe or other smart-wallet user can pay a checkout and start a subscription.
2. The "can't pay here yet" message is gone.
3. For a Safe with several owners, each owner approves the two signing requests in their Safe app, then the payment goes through. If they take too long, the checkout asks them to sign again. They're never charged twice.
4. Nothing changes for people using ordinary wallets like MetaMask or Rabby.

## Important Limitation

- **Redeploy needed:** the payment contracts can't be changed in place, so this ships with the testnet redeploy (#142). It's also part of the contract re-review (#147).
- **Two steps:** this change updates the contracts. The Strimz API and checkout switch to them at the redeploy, because the contracts live today still expect the old signature format.
- **Gas cost:** checking a smart wallet's approval costs a bit more gas, which Strimz pays. We cap it at 600,000 gas per payment, about one cent. A wallet that needs more is refused with a clear error.
- **Approval withdrawn:** a smart wallet can withdraw its approval after it signs. If that happens just before the payment is sent, the payment fails and the payer isn't charged. Strimz pays the small failed-transaction fee, as it already does for any failed payment.

## What Changes

- **Contracts:** they accept a signature of any length and check smart wallets the standard way. Ordinary wallets are checked exactly as before.
- **Strimz API:** it accepts signatures in the new form and still accepts the old form, so merchants' servers keep working.
- **Gas:** Strimz measures each payment's gas instead of using a fixed amount, with the cap above.
- **Checkout:** it sends the wallet's signature as it is, and the smart-wallet block is removed.

## What Does Not Change

- **Payments and fees:** amounts, fees, receipts, webhooks and the dashboard stay the same.
- **Ordinary wallets:** MetaMask, Rabby and similar wallets pay exactly as they do today.
- **Signing:** payers still sign the same two messages.
