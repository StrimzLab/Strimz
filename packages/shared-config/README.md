# @strimz/shared-config

Single source of truth for the Strimz platform's environment-independent constants. If a value (chain id, token address, fee tier, webhook event name, agent flag, CCTP contract) needs to be referenced by more than one app or package, it lives here.

## Modules

| Subpath                          | Exports                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| `@strimz/shared-config/chains`   | `arcTestnet`, `arcMainnet`, `getArcChain`, `isArcChain`, chain id constants           |
| `@strimz/shared-config/tokens`   | `TOKENS`, `TOKEN_ADDRESSES`, `getTokenAddress`, `isPaymentToken`, `PaymentToken` type |
| `@strimz/shared-config/tiers`    | `TIERS`, `effectiveFeeBps`, `getTier`, `MerchantTier` type                            |
| `@strimz/shared-config/webhooks` | `WEBHOOK_EVENTS`, retry schedule, signature header constants                          |
| `@strimz/shared-config/api-keys` | `API_KEY_PREFIXES`, `prefixFor`, `modeFromKey`, `kindFromKey`                         |
| `@strimz/shared-config/agents`   | `AGENT_CAPABILITIES`, `AGENT_DEFAULTS`, capability metadata                           |
| `@strimz/shared-config/cctp`     | CCTP V2 contract addresses, domain ids, source chain registry                         |

The package root (`@strimz/shared-config`) re-exports everything.

## Usage

```ts
import { arcTestnet, getTokenAddress, effectiveFeeBps } from '@strimz/shared-config'

const usdcOnTestnet = getTokenAddress('testnet', 'USDC')
const recurringFeeBps = effectiveFeeBps('growth', 'subscription') // 100 bps (0.8% + 0.2% premium)
```

## Boundaries

- **No environment reads.** This package never touches `process.env`. Apps wire env values into typed config; this package supplies the constants those values key into.
- **No I/O.** Pure data and pure functions only.
- **Cross-language sync.** The Go indexer does not consume this package. Constants the indexer needs (chain id, contract addresses) are passed via env. The TS source of truth here is mirrored only by deployment configuration, not by duplicated code.
