# @strimz/chain-adapter-evm

EVM family adapter — implements `@strimz/chain-adapter` for Base, Arc,
and any other chain that exposes ERC-3009 (gasless transfer auth) and
EIP-2612 (permit) on its USDC token.

## What's wired today (M2)

The adapter ships its **identity surface** in M2:

- `chainId`, `family`, `capabilities` — declarative, used everywhere
  the business layer reasons about a chain.
- `validateAddress` / `normaliseAddress` — viem-backed; cheap.

Submission methods (`preparePayment`, `submitPayment`,
`chargeSubscription`, `refund`) throw `AdapterNotImplementedError`
until subsequent milestones move the existing relayer logic out of
`apps/api/src/modules/relay/` into this package. apps/api continues to
call into its services directly during the transition.

## Configuring an adapter

```ts
import { EvmChainAdapter } from '@strimz/chain-adapter-evm'

const base = new EvmChainAdapter({
  chainId: 'evm:base',
  display: 'Base',
  numericChainId: 8453,
  rpcUrl: process.env.BASE_RPC_URL!,
  contracts: {
    registry: '0x...',
    payments: '0x...',
    subscriptions: '0x...',
    feeCollector: '0x...',
    tokenWhitelist: '0x...',
  },
})
```

Multiple instances coexist in one `ChainAdapterRegistry` — one per
EVM chain you settle on.
