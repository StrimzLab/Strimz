# @strimz/shared-config

## 0.6.0

### Minor Changes

- 2744d9f: Agent capability descriptors carry `available`. Agentic B2B commerce (`commerce`, agent escrow) is `available: false` for launch; every other capability is `true`.

## 0.5.0

### Minor Changes

- 9696813: New `planUpgradeFor(current, volumes)`: the higher plan a merchant's all-time volume earns, or `null`. It never returns a lower plan and never moves an Enterprise merchant.

## 0.4.0

### Minor Changes

- 518b06c: Replace the fee tiers with the pricing-page plans: Free 0 bps, Starter 50 bps from 1,000 of all-time volume, Growth 40 bps from 50,000, and Enterprise by contract. New exports: `PLANS`, `planFeeBps`, `planForVolume`, `planIncludes`, `plansWith`, `lowestPlanWith` and `PLAN_FEE_CEILING_BPS`. `planForVolume` counts USDC and EURC separately and moves up when either reaches a threshold. Removed: `TIERS`, `getTier`, `effectiveFeeBps`, the monthly fees and the subscription premium. `MerchantTier` is now `'free' | 'starter' | 'growth' | 'enterprise'`.

## 0.3.0

### Minor Changes

- 6ea1791: New `arcModeFor(env)`: maps an Arc environment to the mode a deployment on it runs in (`testnet` → `test`, `mainnet` → `live`). Throws on an unknown environment.

## 0.2.0

### Minor Changes

- 0efff34: Arc mainnet is now described with Circle's published values: `ARC_MAINNET_CHAIN_ID` is `5042` (was `5040001`), the RPC is `https://rpc.mainnet.arc.io` and the explorer `https://explorer.arc.io`. Mainnet EURC, USYC, CCTP V2 and Gateway addresses replace the testnet copies, which have no contract on mainnet. Testnet moves to `https://rpc.testnet.arc.io` and `https://explorer.testnet.arc.io`; its chain id and addresses do not change. Both chains declare native USDC with 18 decimals (was 6); the ERC-20 interface in `TOKENS` keeps 6. `getArcChain`, `chainIdFor`, `getTokenAddress` and `getCctpContracts` now throw on an unknown environment instead of returning `undefined`. New exports: `ARC_ENVIRONMENTS`, `isArcEnvironment`, `parseArcEnvironment`, `getArcExplorerUrl`, `arcExplorerTxUrl`, `arcEnvironmentForChainId` and `assertArcChainId`.

## 0.1.1

### Patch Changes

- b1fbded: Standardise README layout and badges. Drop monorepo-internal references and external SDK comparisons from public-facing prose and source comments. No API or behaviour changes.
