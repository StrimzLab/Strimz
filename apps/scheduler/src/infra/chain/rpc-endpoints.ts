import { createPublicClient, fallback, http, type Transport } from 'viem'
import { assertArcChainId, type ArcEnvironment } from '@strimz/shared-config'

/** Primary first, then the fallbacks (ADR-2026-11-22-rpc-per-service). */
export function rpcEndpoints(env: { ARC_RPC_URL: string; ARC_FALLBACK_RPC_URLS: string[] }) {
  return [env.ARC_RPC_URL, ...env.ARC_FALLBACK_RPC_URLS]
}

// viem quotes its URL in every error, so it only ever sees the origin; the real,
// keyed URL is swapped in at fetch time.
function keyHidingHttp(url: string) {
  return http(redactRpcUrl(url), { fetchFn: (_input, init) => fetch(url, init) })
}

/** A request moves to the next endpoint only when the current one fails. */
export function rpcTransport(urls: readonly string[]): Transport {
  const [first, ...rest] = urls
  if (!first) throw new Error('ARC_RPC_URL is required')
  return rest.length === 0
    ? keyHidingHttp(first)
    : fallback([keyHidingHttp(first), ...rest.map(keyHidingHttp)])
}

/** Providers put keys in the path, so logs and errors show the origin only. */
export function redactRpcUrl(url: string): string {
  return new URL(url).origin
}

/** Every endpoint must serve the configured Arc chain, or the service doesn't start. */
export async function assertEndpointsServeChain(
  environment: ArcEnvironment,
  urls: readonly string[],
  chainIdOf: (url: string) => Promise<number> = (url) =>
    createPublicClient({ transport: keyHidingHttp(url) }).getChainId(),
): Promise<string[]> {
  const checked: string[] = []
  for (const url of urls) {
    const host = redactRpcUrl(url)
    const chainId = await chainIdOf(url)
    try {
      assertArcChainId(environment, chainId)
    } catch (err) {
      throw new Error(`RPC endpoint ${host}: ${(err as Error).message}`)
    }
    checked.push(host)
  }
  return checked
}
