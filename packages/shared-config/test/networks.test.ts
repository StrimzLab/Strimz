import { describe, expect, it } from 'vitest'
import {
  ARC_MAINNET_CHAIN_ID,
  ARC_TESTNET_CHAIN_ID,
  arcMainnet,
  arcTestnet,
  chainIdFor,
  arcEnvironmentForChainId,
  arcExplorerTxUrl,
  getArcChain,
  getArcExplorerUrl,
  getCctpContracts,
  getTokenAddress,
  parseArcEnvironment,
  type ArcEnvironment,
} from '../src/index.js'

describe('Arc networks', () => {
  it('describes mainnet as chain 5042 on the arc.io domains', () => {
    expect(ARC_MAINNET_CHAIN_ID).toBe(5042)
    expect(arcMainnet.id).toBe(5042)
    expect(chainIdFor('mainnet')).toBe(5042)
    expect(arcMainnet.rpcUrls.default.http).toEqual(['https://rpc.mainnet.arc.io'])
    expect(arcMainnet.blockExplorers?.default.url).toBe('https://explorer.arc.io')
  })

  it('describes testnet as chain 5042002 on the arc.io domains', () => {
    expect(ARC_TESTNET_CHAIN_ID).toBe(5042002)
    expect(arcTestnet.rpcUrls.default.http).toEqual(['https://rpc.testnet.arc.io'])
    expect(arcTestnet.blockExplorers?.default.url).toBe('https://explorer.testnet.arc.io')
  })

  it.each([arcTestnet, arcMainnet])('declares native USDC with 18 decimals on $name', (chain) => {
    expect(chain.nativeCurrency).toEqual({ name: 'USDC', symbol: 'USDC', decimals: 18 })
  })

  it('gives each environment its explorer', () => {
    expect(getArcExplorerUrl('testnet')).toBe('https://explorer.testnet.arc.io')
    expect(getArcExplorerUrl('mainnet')).toBe('https://explorer.arc.io')
  })

  it('links a transaction on the explorer of its environment', () => {
    expect(arcExplorerTxUrl('mainnet', '0xabc')).toBe('https://explorer.arc.io/tx/0xabc')
    expect(arcExplorerTxUrl('testnet', '0xabc')).toBe('https://explorer.testnet.arc.io/tx/0xabc')
  })

  it('maps each Arc chain id to its environment', () => {
    expect(arcEnvironmentForChainId(5042)).toBe('mainnet')
    expect(arcEnvironmentForChainId(5042002)).toBe('testnet')
  })

  it('refuses a chain id that is not Arc', () => {
    expect(() => arcEnvironmentForChainId(5040001)).toThrow(/5040001.*5042002.*5042/u)
  })
})

describe('Arc mainnet addresses', () => {
  it('uses the published mainnet token addresses', () => {
    expect(getTokenAddress('mainnet', 'USDC')).toBe('0x3600000000000000000000000000000000000000')
    expect(getTokenAddress('mainnet', 'EURC')).toBe('0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1')
    expect(getTokenAddress('mainnet', 'USYC')).toBe('0x8a5D989Bbb96929F689B0200f435f53dA42bF490')
  })

  it('uses the published mainnet CCTP and Gateway addresses', () => {
    expect(getCctpContracts('mainnet')).toEqual({
      tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
      messageTransmitterV2: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
      gatewayWallet: '0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE',
      gatewayMinter: '0x2222222d7164433c4C09B0b0D809a9b52C04C205',
      domainId: 26,
    })
  })

  it('keeps the testnet addresses', () => {
    expect(getTokenAddress('testnet', 'EURC')).toBe('0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a')
    expect(getCctpContracts('testnet').messageTransmitterV2).toBe(
      '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    )
  })
})

describe('unknown environments', () => {
  const unknown = 'Mainnet' as ArcEnvironment

  it.each([
    ['getArcChain', () => getArcChain(unknown)],
    ['getArcExplorerUrl', () => getArcExplorerUrl(unknown)],
    ['getTokenAddress', () => getTokenAddress(unknown, 'USDC')],
    ['getCctpContracts', () => getCctpContracts(unknown)],
    ['chainIdFor', () => chainIdFor(unknown)],
  ])('%s throws, naming the value and the accepted ones', (_name, lookup) => {
    expect(lookup).toThrow(/"Mainnet".*testnet.*mainnet/u)
  })

  it('parses the two environment names', () => {
    expect(parseArcEnvironment('testnet')).toBe('testnet')
    expect(parseArcEnvironment('mainnet')).toBe('mainnet')
  })

  it.each([undefined, '', 'prod', 'Mainnet'])('refuses %j as an environment', (value) => {
    expect(() => parseArcEnvironment(value)).toThrow(/testnet.*mainnet/u)
  })
})
