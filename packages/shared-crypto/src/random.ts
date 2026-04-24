/**
 * Random-bytes and id generation using the Web Crypto RNG
 * (cryptographically secure in every runtime we target).
 */

import { toBase64Url, toHex } from './encoding.js'

export function randomBytes(n: number): Uint8Array {
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error('randomBytes: n must be a positive integer')
  }
  const buf = new Uint8Array(n)
  getRandomValues(buf)
  return buf
}

export function randomHex(nBytes: number): string {
  return toHex(randomBytes(nBytes))
}

export function randomBase64Url(nBytes: number): string {
  return toBase64Url(randomBytes(nBytes))
}

export function uuid(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID()
  }
  // Fallback — RFC 4122 v4 from getRandomValues
  const bytes = randomBytes(16)
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80
  const hex = toHex(bytes)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function getRandomValues(buf: Uint8Array): void {
  const c = globalThis.crypto
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error('crypto.getRandomValues is not available in this runtime')
  }
  c.getRandomValues(buf)
}
