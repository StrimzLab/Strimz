import { describe, expect, it } from 'vitest'
import { getAddress, isAddress } from 'viem'

/**
 * Lives here rather than in `packages/shared-config` because that
 * package ships no test runner and adding one to it is not worth a
 * lockfile change. apps/api already depends on the package, so these
 * exercise its published surface — which is what every consumer sees.
 */

import {
  CCTP_CONTRACTS,
  CCTP_DOMAIN_IDS,
  CCTP_FINALITY_FAST,
  CCTP_FINALITY_STANDARD,
  CCTP_SOURCE_CHAINS,
  getCctpContracts,
  getCctpSourceContracts,
  listCctpSourceChains,
  type ArcEnvironment,
  type CCTPSourceChain,
} from '@strimz/shared-config'

const ENVS: ArcEnvironment[] = ['testnet', 'mainnet']

/**
 * Values published by Circle. Pinned as literals so an edit to the
 * config has to be a deliberate edit to this file too — the one defect
 * this config has actually shipped was a hand-typed address.
 *
 * @see https://developers.circle.com/cctp/references/contract-addresses
 */
const CIRCLE_PUBLISHED = {
  testnet: {
    arbitrum: {
      chainId: 421614,
      domainId: 3,
      tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
      usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    },
  },
  mainnet: {
    arbitrum: {
      chainId: 42161,
      domainId: 3,
      tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
      usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    },
  },
} as const

/** Arbitrum's older bridged USDC. Not burnable by CCTP, not 1:1 with Circle. */
const USDC_E_ARBITRUM = '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8'

function everyAddress(): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = []
  for (const env of ENVS) {
    const dest = CCTP_CONTRACTS[env]
    out.push(
      { label: `${env}.tokenMessengerV2`, value: dest.tokenMessengerV2 },
      { label: `${env}.messageTransmitterV2`, value: dest.messageTransmitterV2 },
      { label: `${env}.gatewayWallet`, value: dest.gatewayWallet },
      { label: `${env}.gatewayMinter`, value: dest.gatewayMinter },
    )
    for (const [chain, cfg] of Object.entries(CCTP_SOURCE_CHAINS[env])) {
      out.push(
        { label: `${env}.${chain}.tokenMessengerV2`, value: cfg.tokenMessengerV2 },
        { label: `${env}.${chain}.usdc`, value: cfg.usdc },
      )
    }
  }
  return out
}

describe('CCTP address integrity', () => {
  it.each(everyAddress())('$label is a syntactically valid address', ({ value }) => {
    expect(isAddress(value)).toBe(true)
  })

  // The one bug this config has shipped: a hand-typed address whose
  // EIP-55 casing was wrong. Same 20 bytes, but `getAddress` rejects it
  // and viem throws at the point of use, on mainnet, mid-payment.
  it.each(everyAddress())('$label carries a correct EIP-55 checksum', ({ value }) => {
    expect(value).toBe(getAddress(value.toLowerCase() as `0x${string}`))
  })
})

describe('CCTP_SOURCE_CHAINS matches Circle', () => {
  for (const env of ENVS) {
    const published = CIRCLE_PUBLISHED[env]
    for (const [chain, want] of Object.entries(published)) {
      describe(`${env}/${chain}`, () => {
        const got = CCTP_SOURCE_CHAINS[env][chain as CCTPSourceChain]

        it('is configured', () => {
          expect(got).toBeDefined()
        })

        it('has Circle’s TokenMessengerV2', () => {
          expect(getAddress(got!.tokenMessengerV2)).toBe(
            getAddress(want.tokenMessengerV2 as `0x${string}`),
          )
        })

        it('has the right USDC', () => {
          expect(getAddress(got!.usdc)).toBe(getAddress(want.usdc as `0x${string}`))
        })

        it('has the right EIP-155 chain id', () => {
          expect(got!.chainId).toBe(want.chainId)
        })

        it('has the right CCTP domain', () => {
          expect(got!.domainId).toBe(want.domainId)
        })
      })
    }
  }

  it('never lists USDC.e on Arbitrum', () => {
    for (const env of ENVS) {
      const arb = CCTP_SOURCE_CHAINS[env].arbitrum
      if (!arb) continue
      expect(getAddress(arb.usdc)).not.toBe(getAddress(USDC_E_ARBITRUM))
    }
  })

  it('does not reuse one environment’s USDC in the other', () => {
    for (const chain of listCctpSourceChains('testnet')) {
      const t = CCTP_SOURCE_CHAINS.testnet[chain]
      const m = CCTP_SOURCE_CHAINS.mainnet[chain]
      if (!t || !m) continue
      expect(getAddress(t.usdc)).not.toBe(getAddress(m.usdc))
      expect(t.chainId).not.toBe(m.chainId)
    }
  })

  it('keeps every entry’s domainId in step with CCTP_DOMAIN_IDS', () => {
    for (const env of ENVS) {
      for (const [chain, cfg] of Object.entries(CCTP_SOURCE_CHAINS[env])) {
        expect(cfg.domainId).toBe(CCTP_DOMAIN_IDS[chain as CCTPSourceChain])
      }
    }
  })

  it('never lists Arc as a source chain', () => {
    // Bridging Arc to Arc is not a thing, and an `arc` entry here would
    // let the checkout offer it.
    for (const env of ENVS) {
      expect(CCTP_SOURCE_CHAINS[env]).not.toHaveProperty('arc')
    }
  })
})

describe('destination is Arc', () => {
  it('uses domain 26', () => {
    expect(CCTP_DOMAIN_IDS.arc).toBe(26)
    for (const env of ENVS) {
      expect(getCctpContracts(env).domainId).toBe(26)
    }
  })
})

describe('finality thresholds', () => {
  it('are CCTP V2’s documented values', () => {
    expect(CCTP_FINALITY_FAST).toBe(1000)
    expect(CCTP_FINALITY_STANDARD).toBe(2000)
  })

  it('rank fast below standard', () => {
    // `minFinalityThreshold` is "attest at or above this level of
    // finality", so fast must be the lower number.
    expect(CCTP_FINALITY_FAST).toBeLessThan(CCTP_FINALITY_STANDARD)
  })
})

describe('lookups', () => {
  it('getCctpSourceContracts returns the configured entry', () => {
    expect(getCctpSourceContracts('testnet', 'arbitrum')).toEqual(
      CCTP_SOURCE_CHAINS.testnet.arbitrum,
    )
  })

  it('getCctpSourceContracts returns undefined for an unwired chain', () => {
    // `solana` is in CCTP_DOMAIN_IDS but has no EVM burn path here.
    expect(getCctpSourceContracts('testnet', 'solana')).toBeUndefined()
  })

  it('listCctpSourceChains agrees with the map', () => {
    for (const env of ENVS) {
      expect(listCctpSourceChains(env).sort()).toEqual(Object.keys(CCTP_SOURCE_CHAINS[env]).sort())
    }
  })

  it('lists only chains CCTP_DOMAIN_IDS knows', () => {
    for (const env of ENVS) {
      for (const chain of listCctpSourceChains(env)) {
        expect(CCTP_DOMAIN_IDS[chain]).toBeTypeOf('number')
      }
    }
  })
})
