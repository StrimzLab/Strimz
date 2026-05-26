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
