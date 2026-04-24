/**
 * Webhook signing and verification.
 *
 * Signature format: `t=<unix_seconds>,v1=<hex_hmac_sha256>`
 *
 * The HMAC is computed over `"${t}.${payload}"` so the timestamp is bound to
 * the signature. Verification enforces a replay window (default 300 seconds,
 * matching `@strimz/shared-config`).
 */

import { WEBHOOK_SIGNATURE_TOLERANCE_SECONDS } from '@strimz/shared-config/webhooks'
import { fromHex, toHex } from './encoding.js'
import { hmacSha256 } from './hmac.js'
import { timingSafeEqualBytes } from './timing-safe.js'

export const WEBHOOK_SIGNATURE_VERSION = 'v1'

export interface SignWebhookOptions {
  /** Unix timestamp in seconds. Defaults to `Math.floor(Date.now() / 1000)`. */
  timestampSeconds?: number
}

export async function signWebhookPayload(
  payload: string,
  secret: string,
  options?: SignWebhookOptions,
): Promise<string> {
  const t = options?.timestampSeconds ?? Math.floor(Date.now() / 1000)
  const signedBody = `${t}.${payload}`
  const mac = await hmacSha256(secret, signedBody)
  return `t=${t},${WEBHOOK_SIGNATURE_VERSION}=${toHex(mac)}`
}

export type VerifyWebhookReason =
  | 'malformed_header'
  | 'missing_timestamp'
  | 'missing_signature'
  | 'timestamp_out_of_range'
  | 'signature_mismatch'

export type VerifyWebhookResult =
  | { valid: true }
  | { valid: false; reason: VerifyWebhookReason }

export interface VerifyWebhookOptions {
  /** Maximum age of a signature in seconds. Defaults to the shared-config tolerance. */
  toleranceSeconds?: number
  /** Override "now" for testing. Unix seconds. */
  nowSeconds?: number
}

export async function verifyWebhookSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
  options: VerifyWebhookOptions = {},
): Promise<VerifyWebhookResult> {
  const tolerance = options.toleranceSeconds ?? WEBHOOK_SIGNATURE_TOLERANCE_SECONDS
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000)

  const parsed = parseSignatureHeader(signatureHeader)
  if (!parsed) return { valid: false, reason: 'malformed_header' }

  const { timestamp, signatureHex } = parsed
  if (timestamp === null) return { valid: false, reason: 'missing_timestamp' }
  if (!signatureHex) return { valid: false, reason: 'missing_signature' }
  if (Math.abs(now - timestamp) > tolerance) {
    return { valid: false, reason: 'timestamp_out_of_range' }
  }

  const expected = await hmacSha256(secret, `${timestamp}.${payload}`)
  let provided: Uint8Array
  try {
    provided = fromHex(signatureHex)
  } catch {
    return { valid: false, reason: 'signature_mismatch' }
  }

  return timingSafeEqualBytes(expected, provided)
    ? { valid: true }
    : { valid: false, reason: 'signature_mismatch' }
}

interface ParsedSignatureHeader {
  timestamp: number | null
  signatureHex: string | null
}

function parseSignatureHeader(header: string): ParsedSignatureHeader | null {
  if (!header || typeof header !== 'string') return null
  const parts = header.split(',')
  let timestamp: number | null = null
  let signatureHex: string | null = null
  for (const part of parts) {
    const eq = part.indexOf('=')
    if (eq <= 0) return null
    const key = part.slice(0, eq).trim()
    const value = part.slice(eq + 1).trim()
    if (key === 't') {
      const n = Number(value)
      if (!Number.isFinite(n) || !Number.isInteger(n)) return null
      timestamp = n
    } else if (key === WEBHOOK_SIGNATURE_VERSION) {
      signatureHex = value
    }
  }
  return { timestamp, signatureHex }
}
