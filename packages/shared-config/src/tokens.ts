/**
 * Token registry for Arc.
 *
 * USDC and EURC are first-class payment tokens. They can be requested in a
 * payment session and used as a subscription currency.
 *
 * USYC is yield-bearing and is treated as a treasury asset only. Merchants
 * can hold it and earn yield, but a payer cannot pay in USYC.
 */

import type { Address } from 'viem'
import { ARC_TESTNET_CHAIN_ID, ARC_MAINNET_CHAIN_ID, type ArcEnvironment } from './chains.js'

export type TokenSymbol = 'USDC' | 'EURC' | 'USYC'

/** Tokens accepted as direct payment by Strimz. USYC is excluded by design. */
export type PaymentToken = Extract<TokenSymbol, 'USDC' | 'EURC'>

export const PAYMENT_TOKENS: readonly PaymentToken[] = ['USDC', 'EURC'] as const

export interface TokenDescriptor {
  symbol: TokenSymbol
  name: string
  decimals: number
  /** Whether the token is accepted as direct payment. */
  paymentEligible: boolean
  /** Whether the token is yield-bearing. */
  yieldBearing: boolean
}

export interface TokenAddress {
  symbol: TokenSymbol
  address: Address
  chainId: number
}

export const TOKENS: Record<TokenSymbol, TokenDescriptor> = {
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    paymentEligible: true,
    yieldBearing: false,
  },
  EURC: {
    symbol: 'EURC',
    name: 'Euro Coin',
    decimals: 6,
    paymentEligible: true,
    yieldBearing: false,
  },
  USYC: {
    symbol: 'USYC',
    name: 'US Yield Coin',
    decimals: 6,
    paymentEligible: false,
    yieldBearing: true,
  },
}

/**
 * Native, Circle-issued addresses on Arc.
 * The same address is reused across testnet and mainnet for native tokens
 * since Arc preserves canonical addresses across environments where possible.
 */
export const TOKEN_ADDRESSES: Record<ArcEnvironment, Record<TokenSymbol, Address>> = {
  testnet: {
    USDC: '0x3600000000000000000000000000000000000000',
    EURC: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
    USYC: '0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C',
  },
  mainnet: {
    // Mainnet addresses pending Arc mainnet beta launch; placeholders mirror
    // testnet for now and must be replaced when Circle publishes the canonical
    // mainnet token registry.
    USDC: '0x3600000000000000000000000000000000000000',
    EURC: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
    USYC: '0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C',
  },
}

export function getTokenAddress(env: ArcEnvironment, symbol: TokenSymbol): Address {
  return TOKEN_ADDRESSES[env][symbol]
}

export function getTokenBySymbol(symbol: string): TokenDescriptor | undefined {
  return (TOKENS as Record<string, TokenDescriptor>)[symbol]
}

export function isPaymentToken(symbol: string): symbol is PaymentToken {
  return PAYMENT_TOKENS.includes(symbol as PaymentToken)
}

export function chainIdFor(env: ArcEnvironment): number {
  return env === 'testnet' ? ARC_TESTNET_CHAIN_ID : ARC_MAINNET_CHAIN_ID
}
