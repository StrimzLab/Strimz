import { createHmac, timingSafeEqual } from 'node:crypto'

// Svix signature verification. Privy uses svix under the hood, so this
// handles Privy webhooks and any other svix-signed source.
//
// Contract:
//   signed = `${svixId}.${svixTimestamp}.${rawBody}`
//   sig    = base64( HMAC_SHA256(secret_bytes, signed) )
//   header = "v1,<sig> v1,<sig-rotated> ..."   (space-separated versions)
//
// The secret arrives as `whsec_<base64>`; we base64-decode the tail.

export interface SvixHeaders {
  id: string
  timestamp: string
  signature: string
}

const TOLERANCE_SEC = 5 * 60

export function readSvixHeaders(
  headers: Record<string, string | string[] | undefined>,
): SvixHeaders | null {
  const id = pick(headers['svix-id'] ?? headers['webhook-id'])
  const timestamp = pick(headers['svix-timestamp'] ?? headers['webhook-timestamp'])
  const signature = pick(headers['svix-signature'] ?? headers['webhook-signature'])
  if (!id || !timestamp || !signature) return null
  return { id, timestamp, signature }
}

export function verifySvix(
  rawBody: string,
  headers: SvixHeaders,
  secret: string,
  now: number = Math.floor(Date.now() / 1000),
): boolean {
  const ts = Number(headers.timestamp)
  if (!Number.isFinite(ts) || Math.abs(now - ts) > TOLERANCE_SEC) return false

  const secretBytes = decodeSecret(secret)
  if (!secretBytes) return false

  const expected = createHmac('sha256', secretBytes)
    .update(`${headers.id}.${headers.timestamp}.${rawBody}`)
    .digest()

  for (const tok of headers.signature.split(' ')) {
    const [version, b64] = tok.split(',')
    if (version !== 'v1' || !b64) continue
    let received: Buffer
    try {
      received = Buffer.from(b64, 'base64')
    } catch {
      continue
    }
    if (received.length !== expected.length) continue
    if (timingSafeEqual(received, expected)) return true
  }
  return false
}

function pick(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null
  return v ?? null
}

function decodeSecret(secret: string): Buffer | null {
  if (!secret.startsWith('whsec_')) return null
  try {
    return Buffer.from(secret.slice('whsec_'.length), 'base64')
  } catch {
    return null
  }
}
