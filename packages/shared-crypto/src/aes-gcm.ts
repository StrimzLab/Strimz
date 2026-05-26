/**
 * AES-256-GCM authenticated symmetric encryption via Web Crypto.
 *
 * Encrypt one short string at a time, decrypt one short string at a
 * time. The encryption key is supplied as a 32-byte hex string by the
 * caller. Suitable for envelope-encrypting small secrets where the
 * key is held outside the data store.
 *
 * AES-GCM is authenticated, so the auth tag detects bit-flips and
 * substitution attacks. A tampered ciphertext fails closed at decrypt
 * time. The 12-byte nonce and 16-byte tag are the canonical layout
 * exposed by Web Crypto.
 *
 * Output format is string-safe and suitable for any text column:
 *
 *     v1:<nonce-hex>:<ciphertext-and-tag-hex>
 *
 * Web Crypto returns the auth tag concatenated to the ciphertext, so
 * the on-the-wire format keeps them together rather than splitting
 * them out. The leading `v1:` lets future schemes coexist during
 * migration.
 *
 * This is not a KMS replacement. The key lives in caller-controlled
 * storage. Rotating it means rotating every encrypted value, or
 * supporting two keys for a cutover window. For sign keys, use a
 * hardware-backed signer pattern instead.
 */

import { fromHex, toHex } from './encoding.js'

const ALGORITHM = 'AES-GCM'
const KEY_LENGTH_BYTES = 32
const NONCE_LENGTH_BYTES = 12
const TAG_LENGTH_BITS = 128
const VERSION_PREFIX = 'v1:'

/**
 * Encrypt a plaintext string with the supplied 32-byte hex key.
 * Returns a versioned, colon-delimited ciphertext blob safe to store
 * in any text column.
 */
export async function encryptAesGcm(plaintext: string, keyHex: string): Promise<string> {
  const key = await importKey(keyHex)
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LENGTH_BYTES))
  const ciphertextWithTag = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: ALGORITHM, iv: nonce as BufferSource, tagLength: TAG_LENGTH_BITS },
      key,
      new TextEncoder().encode(plaintext) as BufferSource,
    ),
  )
  return `${VERSION_PREFIX}${toHex(nonce)}:${toHex(ciphertextWithTag)}`
}

/**
 * Inverse of `encryptAesGcm`. Throws on any tampering or key mismatch
 * with no partial-decrypt path. The caller decides how to
 * surface the failure (log + fail closed for storage; reject the
 * request for hot-path use).
 */
export async function decryptAesGcm(blob: string, keyHex: string): Promise<string> {
  if (!blob.startsWith(VERSION_PREFIX)) {
    throw new Error('decryptAesGcm: unsupported version prefix in blob')
  }
  const parts = blob.slice(VERSION_PREFIX.length).split(':')
  if (parts.length !== 2) {
    throw new Error('decryptAesGcm: malformed blob; expected nonce:ciphertext')
  }
  const [nonceHex, ciphertextHex] = parts as [string, string]
  const nonce = fromHex(nonceHex)
  const ciphertextWithTag = fromHex(ciphertextHex)
  if (nonce.length !== NONCE_LENGTH_BYTES) {
    throw new Error(`decryptAesGcm: nonce must be ${NONCE_LENGTH_BYTES} bytes`)
  }
  const key = await importKey(keyHex)
  const plaintextBytes = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: ALGORITHM, iv: nonce as BufferSource, tagLength: TAG_LENGTH_BITS },
      key,
      ciphertextWithTag as BufferSource,
    ),
  )
  return new TextDecoder().decode(plaintextBytes)
}

/**
 * Convenience helper for generating a fresh 32-byte hex key. Used
 * by ops scripts that seed the env var. Returned as a hex string so
 * it can be pasted into a secrets vault without binary handling.
 */
export function generateAesGcmKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(KEY_LENGTH_BYTES))
  return toHex(bytes)
}

async function importKey(keyHex: string): Promise<CryptoKey> {
  if (!/^[0-9a-fA-F]+$/u.test(keyHex)) {
    throw new Error('encryption key must be a hex-encoded string')
  }
  const bytes = fromHex(keyHex)
  if (bytes.length !== KEY_LENGTH_BYTES) {
    throw new Error(`encryption key must be ${KEY_LENGTH_BYTES} bytes (got ${bytes.length})`)
  }
  return crypto.subtle.importKey('raw', bytes as BufferSource, { name: ALGORITHM }, false, [
    'encrypt',
    'decrypt',
  ])
}
