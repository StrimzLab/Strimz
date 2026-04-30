import { lookup } from 'node:dns/promises'

/**
 * SSRF defence — returns true if a hostname resolves to a private, loopback,
 * link-local, or otherwise non-routable address. Webhook URLs that match are
 * rejected at registration time so a merchant cannot point Strimz at their
 * own internal infrastructure (or someone else's).
 */
export async function isPrivateOrLoopback(hostname: string): Promise<boolean> {
  const lower = hostname.toLowerCase()
  // Block "localhost" and friends without resolving.
  if (lower === 'localhost' || lower === 'ip6-localhost' || lower.endsWith('.local')) {
    return true
  }
  let addrs: Array<{ address: string; family: number }>
  try {
    addrs = await lookup(hostname, { all: true })
  } catch {
    // If DNS doesn't resolve, fail safe — reject the URL.
    return true
  }
  for (const { address } of addrs) {
    if (isPrivateIp(address)) return true
  }
  return false
}

function isPrivateIp(addr: string): boolean {
  // IPv6 loopback / link-local / unique-local.
  if (addr === '::1') return true
  if (addr.startsWith('fc') || addr.startsWith('fd')) return true // fc00::/7
  if (addr.toLowerCase().startsWith('fe80:')) return true // link-local
  // IPv4
  const m = addr.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (!m) return false
  const [a, b] = [Number(m[1]), Number(m[2])]
  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true // link-local
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  return false
}
