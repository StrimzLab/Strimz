import { NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TokensService } from '../../../../src/modules/tokens/tokens.service.js'
import {
  CAP_PERMIT_2612,
  CAP_TRANSFER_AUTH_3009,
} from '../../../../src/modules/tokens/tokens.abi.js'
import type { ChainService } from '../../../../src/infra/chain/chain.service.js'
import type { TypedConfigService } from '../../../../src/config/index.js'

const WHITELIST = '0x0000000000000000000000000000000000005555' as const
const TOKEN = '0x3600000000000000000000000000000000000000' as const
const OWNER = '0x4444444444444444444444444444444444444444' as const

type ReadContractArgs = {
  address: `0x${string}`
  functionName: string
  args?: readonly unknown[]
}

/**
 * Fake `PublicClient.readContract` that dispatches on (address,
 * functionName) to canned responses. Lets us cover whitelisted /
 * not-whitelisted / capability-set / metadata flows without spinning
 * up an actual node.
 */
function makeChain(handlers: Record<string, (args: ReadContractArgs) => unknown>): ChainService {
  return {
    client: {
      async readContract(args: ReadContractArgs): Promise<unknown> {
        const key = `${args.address.toLowerCase()}:${args.functionName}`
        const handler = handlers[key] ?? handlers[args.functionName]
        if (!handler) {
          throw new Error(`fake chain: no handler for ${key}`)
        }
        return handler(args)
      },
    },
  } as unknown as ChainService
}

function makeCfg(whitelist?: string): TypedConfigService {
  return {
    env: { STRIMZ_TOKEN_WHITELIST_ADDRESS: whitelist },
  } as unknown as TypedConfigService
}

describe('TokensService', () => {
  describe('getMetadata', () => {
    it('throws NotFoundException for non-whitelisted tokens', async () => {
      const chain = makeChain({
        [`${WHITELIST.toLowerCase()}:isWhitelisted`]: () => false,
      })
      const svc = new TokensService(chain, makeCfg(WHITELIST))
      await expect(svc.getMetadata(TOKEN)).rejects.toThrow(NotFoundException)
    })

    it('returns full metadata with both capabilities for a whitelisted USDC-shaped token', async () => {
      const chain = makeChain({
        [`${WHITELIST.toLowerCase()}:isWhitelisted`]: () => true,
        [`${WHITELIST.toLowerCase()}:getCapabilities`]: () =>
          CAP_PERMIT_2612 | CAP_TRANSFER_AUTH_3009,
        [`${TOKEN.toLowerCase()}:name`]: () => 'USD Coin',
        [`${TOKEN.toLowerCase()}:symbol`]: () => 'USDC',
        [`${TOKEN.toLowerCase()}:decimals`]: () => 6,
        [`${TOKEN.toLowerCase()}:eip712Domain`]: () => [
          '0x0f',
          'USD Coin',
          '2',
          5042002n,
          TOKEN,
          '0x' + '0'.repeat(64),
          [],
        ],
      })
      const svc = new TokensService(chain, makeCfg(WHITELIST))
      const meta = await svc.getMetadata(TOKEN)
      expect(meta).toEqual({
        address: TOKEN,
        name: 'USD Coin',
        symbol: 'USDC',
        version: '2',
        decimals: 6,
        capabilities: { permit2612: true, transferAuth3009: true },
      })
    })

    it('falls back to version "1" when ERC-5267 is unavailable', async () => {
      const chain = makeChain({
        [`${WHITELIST.toLowerCase()}:isWhitelisted`]: () => true,
        [`${WHITELIST.toLowerCase()}:getCapabilities`]: () => CAP_TRANSFER_AUTH_3009,
        [`${TOKEN.toLowerCase()}:name`]: () => 'Legacy Token',
        [`${TOKEN.toLowerCase()}:symbol`]: () => 'LEG',
        [`${TOKEN.toLowerCase()}:decimals`]: () => 18,
        [`${TOKEN.toLowerCase()}:eip712Domain`]: () => {
          throw new Error('function selector not recognised')
        },
      })
      const svc = new TokensService(chain, makeCfg(WHITELIST))
      const meta = await svc.getMetadata(TOKEN)
      expect(meta.version).toBe('1')
      expect(meta.capabilities).toEqual({ permit2612: false, transferAuth3009: true })
    })

    it('reflects only the capability bits set on the whitelist', async () => {
      const chain = makeChain({
        [`${WHITELIST.toLowerCase()}:isWhitelisted`]: () => true,
        [`${WHITELIST.toLowerCase()}:getCapabilities`]: () => CAP_PERMIT_2612, // only 2612
        [`${TOKEN.toLowerCase()}:name`]: () => 'Permit Only',
        [`${TOKEN.toLowerCase()}:symbol`]: () => 'PO',
        [`${TOKEN.toLowerCase()}:decimals`]: () => 18,
        [`${TOKEN.toLowerCase()}:eip712Domain`]: () => [
          '0x0f',
          'Permit Only',
          '1',
          5042002n,
          TOKEN,
          '0x' + '0'.repeat(64),
          [],
        ],
      })
      const svc = new TokensService(chain, makeCfg(WHITELIST))
      const meta = await svc.getMetadata(TOKEN)
      expect(meta.capabilities).toEqual({ permit2612: true, transferAuth3009: false })
    })

    it('lowercases the returned address', async () => {
      const mixed = '0x360000000000000000000000000000000000ABCD' as `0x${string}`
      const lower = mixed.toLowerCase() as `0x${string}`
      const chain = makeChain({
        [`${WHITELIST.toLowerCase()}:isWhitelisted`]: () => true,
        [`${WHITELIST.toLowerCase()}:getCapabilities`]: () => 0,
        [`${lower}:name`]: () => 'T',
        [`${lower}:symbol`]: () => 'T',
        [`${lower}:decimals`]: () => 0,
        [`${lower}:eip712Domain`]: () => {
          throw new Error('no')
        },
      })
      const svc = new TokensService(chain, makeCfg(WHITELIST))
      const meta = await svc.getMetadata(mixed)
      expect(meta.address).toBe(lower)
    })

    it('throws when STRIMZ_TOKEN_WHITELIST_ADDRESS is unset', async () => {
      const chain = makeChain({})
      const svc = new TokensService(chain, makeCfg(undefined))
      await expect(svc.getMetadata(TOKEN)).rejects.toThrow(/TOKEN_WHITELIST_ADDRESS/)
    })
  })

  describe('getPermitNonce', () => {
    it('returns the nonce as a decimal string', async () => {
      const chain = makeChain({
        [`${TOKEN.toLowerCase()}:nonces`]: () => 42n,
      })
      const svc = new TokensService(chain, makeCfg(WHITELIST))
      const result = await svc.getPermitNonce(TOKEN, OWNER)
      expect(result).toEqual({
        token: TOKEN,
        owner: OWNER.toLowerCase(),
        nonce: '42',
      })
    })

    it('preserves uint256 values that exceed Number.MAX_SAFE_INTEGER', async () => {
      const big = (1n << 200n) + 7n
      const chain = makeChain({
        [`${TOKEN.toLowerCase()}:nonces`]: () => big,
      })
      const svc = new TokensService(chain, makeCfg(WHITELIST))
      const result = await svc.getPermitNonce(TOKEN, OWNER)
      expect(result.nonce).toBe(big.toString())
    })

    it('throws NotFoundException when the token does not implement EIP-2612', async () => {
      const chain = makeChain({
        [`${TOKEN.toLowerCase()}:nonces`]: () => {
          throw new Error('function selector not recognised')
        },
      })
      const svc = new TokensService(chain, makeCfg(WHITELIST))
      await expect(svc.getPermitNonce(TOKEN, OWNER)).rejects.toThrow(NotFoundException)
    })
  })
})
