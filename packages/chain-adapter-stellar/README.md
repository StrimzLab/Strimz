# `@strimz/chain-adapter-stellar`

Stellar family adapter — implements [`@strimz/chain-adapter`](../chain-adapter)
for `stellar:pubnet` and `stellar:testnet`. Backed by
[`@stellar/stellar-sdk`](https://www.npmjs.com/package/@stellar/stellar-sdk)
for XDR + StrKey + Soroban RPC primitives.

## What this adapter does (when complete)

| Port method                                                    | Stellar implementation                                                                                                                                                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `validateAddress` / `normaliseAddress`                         | StrKey checksum validation — accepts both G-accounts (`G…`, 56 chars) and Soroban contract addresses (`C…`, 56 chars). Smart wallets are C-addresses; classic accounts are G-addresses.                                   |
| `capabilities`                                                 | Declarative feature flags — `fee-bump` for gas abstraction, `sep-41-approve` for permits (with `permitHasExpiry: true`, which drives the allowance-expiry dunning lane), USDC/EURC currencies, sponsored-reserve support. |
| `preparePayment`                                               | Build a fee-bump-wrapped Soroban invocation against `StrimzPayments.pay()`. M5b.                                                                                                                                          |
| `submitPayment`                                                | Sign the fee-bump envelope as the Strimz relayer + submit via Stellar RPC. M5c.                                                                                                                                           |
| `prepareSubscriptionEnrolment` / `submitSubscriptionEnrolment` | Same pattern against `StrimzSubscription.enrol()`. M5b/c.                                                                                                                                                                 |
| `chargeSubscription`                                           | Merchant-initiated charge via `StrimzSubscription.charge()`. M5c.                                                                                                                                                         |
| `refund`                                                       | `token.transfer(merchant → payer, amount)` Soroban invocation. M5c.                                                                                                                                                       |
| `subscribeEvents`                                              | Subscribes a projector to Horizon + Stellar RPC event streams. M5d (delegated to `apps/indexer-stellar`).                                                                                                                 |
| `refreshAllowance`                                             | Sends the payer a re-`approve()` envelope before the existing allowance's `live_until_ledger` expires. M5e.                                                                                                               |

## What this milestone (M5a) ships

- Package skeleton + build pipeline.
- `StellarChainAdapter` class implementing the identity + address surface.
- StrKey validation accepting both G and C addresses.
- Declarative capabilities matching the architecture decision in
  `docs/adr/0001-chain-agnostic-architecture.md`.
- Submission methods throw `AdapterNotImplementedError` until the
  subsequent M5b–c milestones land. Same incremental pattern as the
  EVM adapter shipped in M2.

## Configuring an adapter

```ts
import { StellarChainAdapter } from '@strimz/chain-adapter-stellar'

const testnet = new StellarChainAdapter({
  chainId: 'stellar:testnet',
  display: 'Stellar testnet',
  network: 'testnet',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  rpcUrl: 'https://soroban-testnet.stellar.org',
  // Filled in by deploy-testnet.env after M4 deploy lands on-chain.
  contracts: {
    payments: 'C…',
    subscription: 'C…',
    feeCollector: 'C…',
  },
  // SAC handle for USDC on this network. Derived from the asset's
  // (code, issuer) pair via Asset.getContractId(passphrase).
  usdcSac: null,
})
```

Multiple instances live in the same `ChainAdapterRegistry` — one per
Stellar network.
