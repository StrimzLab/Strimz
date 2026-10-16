import { isIP } from 'node:net'

export type LookupAll = (hostname: string) => Promise<Array<{ address: string; family: number }>>

export type TargetPermits = (address: string, port: number) => boolean

export interface ResolvedTarget {
  address: string
  family: 4 | 6
}

export class BlockedWebhookTargetError extends Error {
  constructor(hostname: string, address: string) {
    super(`webhook target ${hostname} resolves to blocked address ${address}`)
    this.name = 'BlockedWebhookTargetError'
  }
}

export async function resolveWebhookTarget(
  hostname: string,
  port: number,
  lookupAll: LookupAll,
  permits: TargetPermits,
): Promise<ResolvedTarget> {
  const host = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname
  const literal = isIP(host)
  const addresses = literal === 0 ? (await lookupAll(host)).map((a) => a.address) : [host]
  const first = addresses[0]
  if (first === undefined) throw new Error(`webhook target ${host} resolved to no addresses`)
  for (const address of addresses) {
    if (!permits(address, port)) throw new BlockedWebhookTargetError(host, address)
  }
  return { address: first, family: isIP(first) === 6 ? 6 : 4 }
}
