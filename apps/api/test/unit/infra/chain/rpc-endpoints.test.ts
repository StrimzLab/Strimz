import { describe, expect, it } from 'vitest'

import {
  assertEndpointsServeChain,
  redactRpcUrl,
  rpcEndpoints,
  rpcTransport,
} from '../../../../src/infra/chain/rpc-endpoints.js'
import { parseFallbackRpcUrls } from '../../../../src/config/rpc-fallbacks.js'

const ALCHEMY = 'https://arc-mainnet.g.alchemy.com/v2/secret-key'
const QUICKNODE = 'https://free.arc-mainnet.quiknode.pro/secret-token/'
const PUBLIC = 'https://rpc.mainnet.arc.io'

async function rejection(p: Promise<unknown>): Promise<Error> {
  try {
    await p
  } catch (err) {
    return err as Error
  }
  throw new Error('expected a rejection')
}

// ADR-2026-11-22-rpc-per-service.
describe('RPC endpoints', () => {
  it('reads the fallback list in order, ignoring blanks', () => {
    expect(parseFallbackRpcUrls(` ${QUICKNODE}, ,${PUBLIC} `)).toEqual([QUICKNODE, PUBLIC])
    expect(parseFallbackRpcUrls(undefined)).toEqual([])
  })

  it('refuses a fallback entry that is not a URL', () => {
    expect(() => parseFallbackRpcUrls('not a url')).toThrow(/ARC_FALLBACK_RPC_URLS/u)
  })

  it('tries the primary first, then each fallback', () => {
    const urls = rpcEndpoints({ ARC_RPC_URL: ALCHEMY, ARC_FALLBACK_RPC_URLS: [QUICKNODE, PUBLIC] })
    expect(urls).toEqual([ALCHEMY, QUICKNODE, PUBLIC])
    const transport = rpcTransport(urls)({})
    expect(transport.config.type).toBe('fallback')
    expect((transport.value as { transports: unknown[] }).transports).toHaveLength(3)
  })

  it('uses a plain transport when there is no fallback', () => {
    expect(rpcTransport([PUBLIC])({}).config.type).toBe('http')
  })

  it('keeps only the host of a keyed URL', () => {
    expect(redactRpcUrl(ALCHEMY)).toBe('https://arc-mainnet.g.alchemy.com')
    expect(redactRpcUrl(QUICKNODE)).toBe('https://free.arc-mainnet.quiknode.pro')
  })

  it('refuses to start when any endpoint serves another chain, without leaking its key', async () => {
    const chainIds: Record<string, number> = { [ALCHEMY]: 5042, [QUICKNODE]: 5042002 }
    const err = await rejection(
      assertEndpointsServeChain('mainnet', [ALCHEMY, QUICKNODE], (url) =>
        Promise.resolve(chainIds[url] ?? 0),
      ),
    )
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toContain('free.arc-mainnet.quiknode.pro')
    expect(err.message).not.toContain('secret-token')
  })

  it('passes when every endpoint serves the configured chain', async () => {
    await expect(
      assertEndpointsServeChain('mainnet', [ALCHEMY, PUBLIC], () => Promise.resolve(5042)),
    ).resolves.toEqual(['https://arc-mainnet.g.alchemy.com', 'https://rpc.mainnet.arc.io'])
  })
})

describe('RPC errors', () => {
  it('never carry the endpoint key', async () => {
    const { createPublicClient } = await import('viem')
    const { rpcTransport: transport } = await import('../../../../src/infra/chain/rpc-endpoints.js')
    const client = createPublicClient({
      transport: transport([
        'http://127.0.0.1:9/v2/secret-key',
        'http://127.0.0.1:9/secret-token/',
      ]),
    })
    const err = await rejection(client.getChainId())
    expect(err).toBeInstanceOf(Error)
    expect(`${err.message} ${JSON.stringify(err)}`).not.toMatch(/secret-(key|token)/u)
  })
})
