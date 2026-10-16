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
export const ARC_MAINNET_CHAIN_ID = 5042 as const

const NATIVE_USDC = {
  name: 'USDC',
  symbol: 'USDC',
  decimals: 18,
} as const

export const arcTestnet: Chain = defineChain({
  id: ARC_TESTNET_CHAIN_ID,
  name: 'Arc Testnet',
  nativeCurrency: NATIVE_USDC,
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.io'] },
    public: { http: ['https://rpc.testnet.arc.io'] },
  },
  blockExplorers: {
    default: {
      name: 'Arc Testnet Explorer',
      url: 'https://explorer.testnet.arc.io',
    },
  },
  testnet: true,
})

export const arcMainnet: Chain = defineChain({
  id: ARC_MAINNET_CHAIN_ID,
  name: 'Arc',
  nativeCurrency: NATIVE_USDC,
  rpcUrls: {
    default: { http: ['https://rpc.mainnet.arc.io'] },
    public: { http: ['https://rpc.mainnet.arc.io'] },
  },
  blockExplorers: {
    default: {
      name: 'Arc Explorer',
      url: 'https://explorer.arc.io',
    },
  },
  testnet: false,
})

export type ArcEnvironment = 'testnet' | 'mainnet'

export const ARC_CHAINS: Record<ArcEnvironment, Chain> = {
  testnet: arcTestnet,
  mainnet: arcMainnet,
}

export const ARC_ENVIRONMENTS: readonly ArcEnvironment[] = ['testnet', 'mainnet'] as const

export function isArcEnvironment(value: unknown): value is ArcEnvironment {
  return typeof value === 'string' && (ARC_ENVIRONMENTS as readonly string[]).includes(value)
}

export function parseArcEnvironment(value: unknown): ArcEnvironment {
  if (isArcEnvironment(value)) return value
  throw new Error(
    `unknown Arc environment ${JSON.stringify(value)}: expected one of ${ARC_ENVIRONMENTS.join(', ')}`,
  )
}

export function getArcChain(env: ArcEnvironment): Chain {
  return ARC_CHAINS[parseArcEnvironment(env)]
}

export function getArcExplorerUrl(env: ArcEnvironment): string {
  const explorer = getArcChain(env).blockExplorers?.default.url
  if (!explorer) throw new Error(`Arc ${env} has no block explorer configured`)
  return explorer
}

export function arcExplorerTxUrl(env: ArcEnvironment, txHash: string): string {
  return `${getArcExplorerUrl(env)}/tx/${txHash}`
}

export function arcEnvironmentForChainId(chainId: number): ArcEnvironment {
  const env = ARC_ENVIRONMENTS.find((candidate) => ARC_CHAINS[candidate].id === chainId)
  if (!env) {
    throw new Error(
      `chain id ${chainId} is not an Arc chain: expected ${ARC_TESTNET_CHAIN_ID} (testnet) or ${ARC_MAINNET_CHAIN_ID} (mainnet)`,
    )
  }
  return env
}

export function assertArcChainId(env: ArcEnvironment, rpcChainId: number): void {
  const expected = getArcChain(env).id
  if (rpcChainId !== expected) {
    throw new Error(
      `ARC_RPC_URL serves chain id ${rpcChainId}, but ARC_ENVIRONMENT=${env} expects chain id ${expected}`,
    )
  }
}

export function isArcChain(chainId: number): boolean {
  return chainId === ARC_TESTNET_CHAIN_ID || chainId === ARC_MAINNET_CHAIN_ID
}
