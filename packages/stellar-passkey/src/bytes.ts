/**
 * Byte-level encoding helpers used by the passkey flow.
 *
 * WebAuthn passes credential ids around as ArrayBuffer, but our React
 * forms and Postgres columns store them as strings — base64url for
 * over-the-wire, hex for human-readable debug. These helpers keep the
 * conversions in one place so nothing in the rest of the codebase has
 * to know about them.
 */

const BASE64URL_PAD_RE = /=+$/g

/**
 * Encodes raw bytes as base64url — base64 with `+`/`/` replaced by
 * `-`/`_` and padding stripped. The WebAuthn spec uses base64url for
 * credential ids on the wire, so this is what gets persisted.
 */
export function toBase64Url(input: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < input.length; i++) {
    binary += String.fromCharCode(input[i] as number)
  }
  // Browser + modern Node both ship btoa/atob; no fallback needed.
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(BASE64URL_PAD_RE, '')
}

/**
 * Decodes a base64url string back to bytes. Tolerates strings with or
 * without trailing padding.
 */
export function fromBase64Url(input: string): Uint8Array {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
  const binary = atob(b64 + pad)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i)
  }
  return out
}

/** Returns the lowercase hex form (no `0x` prefix). */
export function bytesToHex(input: Uint8Array): string {
  let out = ''
  for (let i = 0; i < input.length; i++) {
    const byte = input[i] as number
    out += byte < 16 ? '0' + byte.toString(16) : byte.toString(16)
  }
  return out
}
