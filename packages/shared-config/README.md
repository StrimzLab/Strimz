# @strimz/shared-config

> Chain definitions, token registry, fee tiers, webhook events, and agent flags for the Strimz platform.

[![npm version](https://img.shields.io/npm/v/@strimz/shared-config.svg?color=02C76A)](https://www.npmjs.com/package/@strimz/shared-config)
[![npm downloads](https://img.shields.io/npm/dm/@strimz/shared-config.svg)](https://www.npmjs.com/package/@strimz/shared-config)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@strimz/shared-config.svg?label=size)](https://bundlephobia.com/package/@strimz/shared-config)
[![types](https://img.shields.io/npm/types/@strimz/shared-config.svg)](https://www.npmjs.com/package/@strimz/shared-config)
[![License: MIT](https://img.shields.io/badge/License-MIT-02C76A.svg)](./LICENSE)

The constants every Strimz app and package needs to agree on. Chain
ids and RPC defaults, token addresses across networks, the platform's
fee tier table, webhook event names, the CCTP V2 contract registry,
and the agent capability list. Pure data and pure functions. No
`process.env` reads, no I/O.

## Install

```sh
pnpm add @strimz/shared-config
# npm install @strimz/shared-config
# yarn add @strimz/shared-config
```

## Quick start

```ts
import { arcTestnet, getTokenAddress, effectiveFeeBps } from '@strimz/shared-config'

const usdcOnTestnet = getTokenAddress('testnet', 'USDC')
const recurringFeeBps = effectiveFeeBps('growth', 'subscription') // 100 bps
```

## Modules

Every group is also available as a subpath import for tree-shaking.

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

## Runtime support

Pure TypeScript with one runtime dependency on `viem`. Works in Node
22+, every modern browser, Vercel Edge, Cloudflare Workers, Deno, and
Bun.

## Design notes

- **No environment reads.** Apps wire `process.env` values into their own typed config; this package supplies the constants those values key into.
- **No I/O.** Every export is either a constant or a pure function.
- **Tree-shakable.** Subpath imports let you pull only the constants you need.

## Links

- [Documentation](https://strimz.finance/docs)
- [Repository](https://github.com/StrimzLab/Strimz/tree/main/packages/shared-config)
- [Changelog](./CHANGELOG.md)
- [Issues](https://github.com/StrimzLab/Strimz/issues)

## License

[MIT](./LICENSE) © Strimz
