/**
 * HMAC-SHA256 via Web Crypto.
 * Keys accept either a string (UTF-8) or raw bytes.
 */

import { toHex, utf8ToBytes } from './encoding.js'

export async function hmacSha256(
  key: string | Uint8Array,
  message: string | Uint8Array,
): Promise<Uint8Array> {
  const keyBytes = typeof key === 'string' ? utf8ToBytes(key) : key
  const msgBytes = typeof message === 'string' ? utf8ToBytes(message) : message
  const subtle = requireSubtle()

  const cryptoKey = await subtle.importKey(
    'raw',
    keyBytes as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await subtle.sign('HMAC', cryptoKey, msgBytes as BufferSource)
  return new Uint8Array(signature)
}

export async function hmacSha256Hex(
  key: string | Uint8Array,
  message: string | Uint8Array,
): Promise<string> {
  return toHex(await hmacSha256(key, message))
}

function requireSubtle(): SubtleCrypto {
  const c = globalThis.crypto
  if (!c || !c.subtle) {
    throw new Error('Web Crypto is not available in this runtime')
  }
  return c.subtle
}
