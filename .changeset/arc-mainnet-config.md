---
'@strimz/shared-config': minor
---

Arc mainnet is now described with Circle's published values: `ARC_MAINNET_CHAIN_ID` is `5042` (was `5040001`), the RPC is `https://rpc.mainnet.arc.io` and the explorer `https://explorer.arc.io`. Mainnet EURC, USYC, CCTP V2 and Gateway addresses replace the testnet copies, which have no contract on mainnet. Testnet moves to `https://rpc.testnet.arc.io` and `https://explorer.testnet.arc.io`; its chain id and addresses do not change. Both chains declare native USDC with 18 decimals (was 6); the ERC-20 interface in `TOKENS` keeps 6. `getArcChain`, `chainIdFor`, `getTokenAddress` and `getCctpContracts` now throw on an unknown environment instead of returning `undefined`. New exports: `ARC_ENVIRONMENTS`, `isArcEnvironment`, `parseArcEnvironment`, `getArcExplorerUrl`, `arcExplorerTxUrl`, `arcEnvironmentForChainId` and `assertArcChainId`.
