/**
 * Arc blockchain definitions.
 *
 * Arc is Circle's stablecoin-native L1 where gas is paid in USDC.
 * - Testnet is live (chain id 5042002).
 * - Mainnet beta is expected in 2026; the mainnet entry is a placeholder
 *   until Circle publishes the production chain id and RPC endpoint.
 *
 * @see https://docs.arc.network
 */

import { defineChain, type Chain } from 'viem'

export const ARC_TESTNET_CHAIN_ID = 5042002 as const
export const ARC_MAINNET_CHAIN_ID = 5040001 as const

const NATIVE_USDC = {
  name: 'USD Coin',
  symbol: 'USDC',
  decimals: 6,
} as const

export const arcTestnet: Chain = defineChain({
  id: ARC_TESTNET_CHAIN_ID,
  name: 'Arc Testnet',
  nativeCurrency: NATIVE_USDC,
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
    public: { http: ['https://rpc.testnet.arc.network'] },
  },
  blockExplorers: {
    default: {
      name: 'ArcScan',
      url: 'https://testnet.arcscan.app',
    },
  },
  testnet: true,
})

export const arcMainnet: Chain = defineChain({
  id: ARC_MAINNET_CHAIN_ID,
  name: 'Arc',
  nativeCurrency: NATIVE_USDC,
  rpcUrls: {
    default: { http: ['https://rpc.arc.network'] },
    public: { http: ['https://rpc.arc.network'] },
  },
  blockExplorers: {
    default: {
      name: 'ArcScan',
      url: 'https://arcscan.app',
    },
  },
  testnet: false,
})

export type ArcEnvironment = 'testnet' | 'mainnet'

export const ARC_CHAINS: Record<ArcEnvironment, Chain> = {
  testnet: arcTestnet,
  mainnet: arcMainnet,
}

export function getArcChain(env: ArcEnvironment): Chain {
  return ARC_CHAINS[env]
}

export function isArcChain(chainId: number): boolean {
  return chainId === ARC_TESTNET_CHAIN_ID || chainId === ARC_MAINNET_CHAIN_ID
}
