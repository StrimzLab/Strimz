/**
 * AES-256-GCM authenticated symmetric encryption via Web Crypto.
 *
 * Used by the webhook layer to encrypt signing secrets at rest in
 * Postgres. Sized at the smallest interface that does the job —
 * encrypt one short string at a time, decrypt one short string at a
 * time, with the encryption key supplied as a 32-byte hex string from
 * environment configuration.
 *
 * Why Web Crypto over `node:crypto`: the rest of `@strimz/shared-crypto`
 * targets Node 22, Vercel Edge, and Cloudflare Workers uniformly.
 * Keeping this consistent so the package can be imported anywhere
 * without conditional branches.
 *
 * Why AES-256-GCM:
 *  - Authenticated. The auth tag detects bit-flips or substitution
 *    attacks; a tampered ciphertext fails closed at decrypt time.
 *  - Standard. Available natively in Web Crypto with no third-party
 *    dependency.
 *  - 12-byte nonce + 16-byte tag is the canonical layout.
 *
 * Output format (string-safe so it goes into Postgres TEXT columns
 * without re-encoding):
 *
 *     v1:<nonce-hex>:<ciphertext-and-tag-hex>
 *
 * Web Crypto returns the auth tag concatenated to the ciphertext,
 * so the on-the-wire format keeps them together rather than splitting
 * them out. The leading `v1:` lets future schemes coexist during
 * migration.
 *
 * What this is NOT:
 *  - A KMS replacement. The key lives in env. Rotating it means
 *    rotating every encrypted value (or supporting two keys for a
 *    cutover window). Graduate to a hardware-backed envelope when
 *    funded — the `KmsSigner` abstraction in the API is the parallel
 *    pattern for sign keys.
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
 * in a Postgres TEXT column.
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
 * — there is no partial-decrypt path. The caller decides how to
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
 * Convenience helper for generating a fresh 32-byte hex key — used
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
