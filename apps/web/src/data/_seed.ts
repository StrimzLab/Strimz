/**
 * Tiny deterministic PRNG so mock generators produce the same data on
 * server + client (no hydration mismatches) and across page refreshes.
 * Replace with backend integrations as resources land.
 */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)]!
}

export function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i)
}

export function id(prefix: string, n: number): string {
  return `${prefix}_${n.toString(36).padStart(6, '0')}cmh${(n * 7919).toString(36).slice(-6)}`
}

export function walletAddress(rng: () => number): string {
  const hex = '0123456789abcdef'
  let out = '0x'
  for (let i = 0; i < 40; i++) out += hex[Math.floor(rng() * 16)]
  return out
}

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function txHash(rng: () => number): string {
  const hex = '0123456789abcdef'
  let out = '0x'
  for (let i = 0; i < 64; i++) out += hex[Math.floor(rng() * 16)]
  return out
}

/** Deterministic ISO date `n` days ago, stable across renders. */
export function daysAgo(n: number, hour = 12): string {
  // Anchor on a fixed reference date so SSR + CSR agree.
  const anchor = new Date('2026-05-01T00:00:00Z').getTime()
  return new Date(anchor - n * 86_400_000 + hour * 3_600_000).toISOString()
}

export const FIRST_NAMES = [
  'Aisha', 'Mateo', 'Yuki', 'Liam', 'Zara', 'Noah', 'Priya', 'Olu', 'Sven',
  'Ines', 'Hiro', 'Kofi', 'Maya', 'Diego', 'Lucia', 'Adam', 'Chen', 'Esther',
  'Rohit', 'Tara', 'Bea', 'Kai', 'Nadia', 'Omar', 'Vivian',
] as const

export const LAST_NAMES = [
  'Aluko', 'Smith', 'Tanaka', 'Garcia', 'Patel', 'Nguyen', 'Müller', 'Cohen',
  'Okafor', 'Rossi', 'Lee', 'Park', 'Khan', 'Silva', 'Klein', 'Mehta',
  'Bauer', 'Diallo', 'Yamamoto', 'Eze',
] as const

export const COMPANIES = [
  'Acme', 'Northwind', 'Globex', 'Initech', 'Soylent', 'Umbrella', 'Hooli',
  'Pied Piper', 'Vandelay', 'Stark Industries', 'Wayne Enterprises', 'Tyrell',
  'Cyberdyne', 'Nakatomi', 'Massive Dynamic', 'Aperture',
] as const

export function fullName(rng: () => number): string {
  return `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`
}

export function emailFor(name: string, company?: string): string {
  const local = name.toLowerCase().replace(/\s+/g, '.')
  const domain = company ? `${company.toLowerCase().replace(/\s+/g, '')}.io` : 'gmail.com'
  return `${local}@${domain}`
}

/** Format USDC smallest-units (6dp) to a human string. */
export function formatUsdc(amount: string | number): string {
  const n = typeof amount === 'string' ? Number(amount) : amount
  return (n / 1_000_000).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatUsdcCompact(amount: string | number): string {
  const n = typeof amount === 'string' ? Number(amount) : amount
  return (n / 1_000_000).toLocaleString('en-US', {
    notation: n >= 100_000_000 ? 'compact' : 'standard',
    maximumFractionDigits: 2,
  })
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = 60_000
  const hr = 60 * min
  const day = 24 * hr
  if (diff < min) return 'just now'
  if (diff < hr) return `${Math.floor(diff / min)}m ago`
  if (diff < day) return `${Math.floor(diff / hr)}h ago`
  if (diff < 30 * day) return `${Math.floor(diff / day)}d ago`
  if (diff < 365 * day) return `${Math.floor(diff / (30 * day))}mo ago`
  return `${Math.floor(diff / (365 * day))}y ago`
}
