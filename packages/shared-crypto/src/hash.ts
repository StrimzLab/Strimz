/**
 * SHA-256 via Web Crypto (available in Node 16+, Deno, Bun, Workers, Edge).
 */

import { toHex, utf8ToBytes } from './encoding.js'

export async function sha256(data: string | Uint8Array): Promise<Uint8Array> {
  const bytes = typeof data === 'string' ? utf8ToBytes(data) : data
  const digest = await subtle().digest('SHA-256', bytes as BufferSource)
  return new Uint8Array(digest)
}

export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  return toHex(await sha256(data))
}

function subtle(): SubtleCrypto {
  const c = globalThis.crypto
  if (!c || !c.subtle) {
    throw new Error('Web Crypto is not available in this runtime')
  }
  return c.subtle
}
