/**
 * Circle CCTP V2 contract addresses for Arc.
 *
 * CCTP lets a payer hold USDC on any supported chain (Ethereum, Base, Polygon,
 * Arbitrum, Solana, etc.) and pay a Strimz merchant who receives Arc USDC.
 *
 * @see https://developers.circle.com/stablecoins/cctp-getting-started
 */

import type { Address } from 'viem'
import type { ArcEnvironment } from './chains.js'

export interface CCTPContractSet {
  tokenMessengerV2: Address
  messageTransmitterV2: Address
  gatewayWallet: Address
  gatewayMinter: Address
  /** CCTP domain identifier for the destination chain. */
  domainId: number
}

export const CCTP_CONTRACTS: Record<ArcEnvironment, CCTPContractSet> = {
  testnet: {
    tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitterV2: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    gatewayWallet: '0x0077777d7EBA4688BDeF3E311b846F25870A19B9',
    gatewayMinter: '0x0022222ABE238Cc2C7Bb1f21003F0a260052475B',
    domainId: 26,
  },
  mainnet: {
    // Pending Circle's mainnet publication of CCTP V2 addresses for Arc.
    // Testnet values are mirrored as a placeholder so type signatures stay non-null.
    tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitterV2: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    gatewayWallet: '0x0077777d7EBA4688BDeF3E311b846F25870A19B9',
    gatewayMinter: '0x0022222ABE238Cc2C7Bb1f21003F0a260052475B',
    domainId: 26,
  },
}

/** CCTP domain ids for source chains a payer can bridge from. */
export const CCTP_DOMAIN_IDS = {
  ethereum: 0,
  avalanche: 1,
  optimism: 2,
  arbitrum: 3,
  noble: 4,
  solana: 5,
  base: 6,
  polygon: 7,
  arc: 26,
} as const

export type CCTPSourceChain = keyof typeof CCTP_DOMAIN_IDS

export const CCTP_SUPPORTED_SOURCE_CHAINS: readonly CCTPSourceChain[] = [
  'ethereum',
  'avalanche',
  'optimism',
  'arbitrum',
  'base',
  'polygon',
  'solana',
] as const

export function getCctpContracts(env: ArcEnvironment): CCTPContractSet {
  return CCTP_CONTRACTS[env]
}

/** Contracts a payer touches on the chain they fund from. */
export interface CCTPSourceContracts {
  chainId: number
  domainId: number
  tokenMessengerV2: Address
  usdc: Address
}

/**
 * Chains a payer can fund an Arc checkout from.
 *
 * This is the wired-up set, not the protocol's. `CCTP_DOMAIN_IDS` is
 * Circle's full domain table and says nothing about what ships here —
 * a chain only works once it has an entry below and an entry in the
 * checkout's wagmi networks.
 *
 * CCTP V2 uses one TokenMessenger address across every supported EVM
 * chain per environment, which is why these mirror the Arc values in
 * `CCTP_CONTRACTS`.
 */
export const CCTP_SOURCE_CHAINS: Record<
  ArcEnvironment,
  Partial<Record<CCTPSourceChain, CCTPSourceContracts>>
> = {
  testnet: {
    arbitrum: {
      chainId: 421614,
      domainId: CCTP_DOMAIN_IDS.arbitrum,
      tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
      usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    },
  },
  mainnet: {
    arbitrum: {
      chainId: 42161,
      domainId: CCTP_DOMAIN_IDS.arbitrum,
      tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
      // Native USDC. NOT USDC.e (0xFF970A61...), which is the older
      // bridged token, not burnable by CCTP and not 1:1 with Circle.
      usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    },
  },
}

/**
 * CCTP V2 `minFinalityThreshold`. Fast attests against a soft-confirmed
 * source block in ~13s and charges a fee; standard waits for finality
 * and is free but can take ~13min. Checkout uses fast — nobody sits on
 * a payment page for thirteen minutes.
 */
export const CCTP_FINALITY_FAST = 1000
export const CCTP_FINALITY_STANDARD = 2000

export function getCctpSourceContracts(
  env: ArcEnvironment,
  chain: CCTPSourceChain,
): CCTPSourceContracts | undefined {
  return CCTP_SOURCE_CHAINS[env][chain]
}

/** Source chains actually configured for an environment. Drives the picker. */
export function listCctpSourceChains(env: ArcEnvironment): CCTPSourceChain[] {
  return Object.keys(CCTP_SOURCE_CHAINS[env]) as CCTPSourceChain[]
}
