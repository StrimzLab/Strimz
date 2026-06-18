/**
 * Native WebAuthn helpers.
 *
 * `createPasskey` runs the registration ceremony and returns the
 * device-bound credential id + the SPKI-formatted public key (when
 * the browser exposes it via `getPublicKey()`). `signWithPasskey`
 * runs an assertion against an existing credential. Both are
 * thin wrappers — no compatibility matrix here, just a minimal
 * surface the rest of the package builds on.
 *
 * The browser-only Web APIs (`navigator.credentials`, `crypto`,
 * `PublicKeyCredential`) are dereferenced inside the functions, never
 * at module top level, so importing this file in a Node environment
 * (Vitest, the Nest API server) doesn't throw at load time.
 */

import { toBase64Url } from './bytes.js'
import type { CreatePasskeyResult } from './types.js'

/**
 * The set of COSE algorithm ids the authenticator may choose from,
 * ordered by Strimz preference. ES256 (-7) is the spec-mandated
 * P-256 ECDSA scheme that Soroban's secp256r1 host function
 * verifies on-chain — for the merchant's smart wallet to work, the
 * passkey MUST be ES256.
 */
const ES256 = -7

export interface CreatePasskeyInput {
  /** Relying-party metadata surfaced in the OS picker. */
  rp: { name: string; id?: string }
  /** Per-user identity. `id` must be unique + stable per merchant. */
  user: { id: Uint8Array; name: string; displayName: string }
  /**
   * Optional override for the WebAuthn-mandated challenge bytes. We
   * generate a random 32-byte challenge when none is supplied — the
   * challenge is irrelevant on Strimz's create path (we never verify
   * the attestation; the smart wallet binds to the credential id),
   * but the API requires it.
   */
  challenge?: Uint8Array
  /** Authenticator selection criteria. Defaults to platform + UV required. */
  authenticatorSelection?: AuthenticatorSelectionCriteria
  /** Timeout in milliseconds. Defaults to 90s. */
  timeoutMs?: number
}

/**
 * Runs `navigator.credentials.create({ publicKey })` with sensible
 * defaults for the merchant onboarding case + returns the credential
 * id and public key in shapes the rest of the package consumes.
 */
export async function createPasskey(input: CreatePasskeyInput): Promise<CreatePasskeyResult> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    throw new Error('createPasskey can only run in a browser')
  }

  const challenge = input.challenge ?? randomBytes(32)

  // The WebAuthn DOM types require `BufferSource`, which TS 5.9
  // narrows to ArrayBuffer-backed Uint8Arrays only. Our inputs are
  // always ArrayBuffer-backed at runtime; the cast is purely a type
  // bridge (`asBufferSource` lives at the bottom of this file).
  const credential = (await navigator.credentials.create({
    publicKey: {
      rp: input.rp,
      user: {
        id: asBufferSource(input.user.id),
        name: input.user.name,
        displayName: input.user.displayName,
      },
      challenge: asBufferSource(challenge),
      pubKeyCredParams: [{ type: 'public-key', alg: ES256 }],
      authenticatorSelection: input.authenticatorSelection ?? {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: input.timeoutMs ?? 90_000,
      attestation: 'none',
    },
  })) as PublicKeyCredential | null

  if (!credential) {
    throw new Error('passkey creation returned no credential')
  }

  const credentialId = new Uint8Array(credential.rawId)
  const response = credential.response as AuthenticatorAttestationResponse

  let publicKey: Uint8Array | null = null
  let publicKeyAlgorithm: number | null = null

  if (typeof response.getPublicKeyAlgorithm === 'function') {
    const alg = response.getPublicKeyAlgorithm()
    if (typeof alg === 'number') publicKeyAlgorithm = alg
  }

  // First-choice path: modern browsers (Safari 14+, Chrome 85+) expose
  // an SPKI-encoded public key via `getPublicKey()`. SPKI is an ASN.1
  // DER envelope — for P-256 ES256, the trailing 65 bytes ARE the
  // uncompressed point (`0x04 || x || y`), which is what the Soroban
  // smart-wallet contract's Secp256r1 signer stores. We slice the tail
  // rather than parse the ASN.1 because every well-formed P-256 SPKI
  // ends with the same structure.
  if (typeof response.getPublicKey === 'function') {
    const spki = response.getPublicKey()
    if (spki) {
      const bytes = new Uint8Array(spki)
      const tail = bytes.slice(bytes.length - 65)
      if (tail[0] === 0x04 && tail.length === 65) publicKey = tail
    }
  }

  // Fallback: scan the attestationObject for the canonical CBOR
  // COSE_Key prefix for ES256/P-256 and pull `x` + `y` from there.
  // The prefix is fixed by RFC 8152 + WebAuthn — same 10 bytes for
  // every ES256 credential, so a substring scan is correct + cheap.
  if (!publicKey) {
    const attestationObject = new Uint8Array(response.attestationObject)
    publicKey = parseEs256PublicKeyFromAttestation(attestationObject)
  }

  return {
    credentialId,
    credentialIdBase64Url: toBase64Url(credentialId),
    publicKey,
    publicKeyAlgorithm,
  }
}

export interface SignWithPasskeyInput {
  /** The 32-byte digest the wallet contract will verify on-chain. */
  challenge: Uint8Array
  /** Restrict the ceremony to specific credential ids. */
  allowCredentials?: Uint8Array[]
  /** Defaults to 90s. */
  timeoutMs?: number
}

export interface SignWithPasskeyResult {
  /** Credential id the authenticator used. */
  credentialId: Uint8Array
  /** DER-encoded ECDSA signature returned by the authenticator. */
  signature: Uint8Array
  /** Authenticator-supplied bytes the contract re-derives the digest from. */
  authenticatorData: Uint8Array
  /** JSON-encoded client data — also part of the on-chain digest. */
  clientDataJSON: Uint8Array
}

/**
 * Runs an assertion ceremony. Not consumed by M3 (we only capture the
 * address), but lives here so M6 (checkout sign-and-pay) doesn't have
 * to reimplement the browser-side glue.
 */
export async function signWithPasskey(input: SignWithPasskeyInput): Promise<SignWithPasskeyResult> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    throw new Error('signWithPasskey can only run in a browser')
  }

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: asBufferSource(input.challenge),
      allowCredentials: input.allowCredentials?.map((id) => ({
        type: 'public-key',
        id: asBufferSource(id),
      })),
      userVerification: 'required',
      timeout: input.timeoutMs ?? 90_000,
    },
  })) as PublicKeyCredential | null

  if (!assertion) {
    throw new Error('passkey assertion returned no credential')
  }

  const response = assertion.response as AuthenticatorAssertionResponse
  return {
    credentialId: new Uint8Array(assertion.rawId),
    signature: new Uint8Array(response.signature),
    authenticatorData: new Uint8Array(response.authenticatorData),
    clientDataJSON: new Uint8Array(response.clientDataJSON),
  }
}

/**
 * Crypto-quality random bytes. Uses `crypto.getRandomValues` so the
 * output is suitable for cryptographic challenges.
 */
function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(out)
  } else {
    throw new Error('crypto.getRandomValues is unavailable')
  }
  return out
}

/**
 * Cast a `Uint8Array` to `BufferSource` for the WebAuthn DOM types.
 * TS 5.9's stricter lib types reject `Uint8Array<ArrayBufferLike>` here
 * because `ArrayBufferLike` may be `SharedArrayBuffer`; in practice
 * every Uint8Array we hand to WebAuthn is plain ArrayBuffer-backed.
 * This bridge is intentionally a one-line cast, isolated so the
 * unsafety is auditable in one place.
 */
function asBufferSource(value: Uint8Array): BufferSource {
  return value as unknown as BufferSource
}

/**
 * Canonical 10-byte CBOR prefix for an ES256/P-256 COSE_Key:
 *
 *   A5         map(5)
 *   01 02      kty   → EC2
 *   03 26      alg   → -7 (ES256)
 *   20 01      crv   → P-256
 *   21         key(-2)  → x
 *   58 20      bytes(32)
 *
 * Immediately followed by the 32-byte x coordinate; after that, a
 * 3-byte key/length header (`22 58 20`) precedes the 32-byte y.
 *
 * Searching for this exact 10-byte prefix inside the attestationObject
 * is the cheapest way to extract the public key when `getPublicKey()`
 * isn't available — the prefix is fixed by spec for every ES256
 * credential, so a substring scan is unambiguous.
 */
const ES256_COSE_PREFIX = new Uint8Array([
  0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20,
])

/**
 * Pulls the 65-byte uncompressed P-256 public key from the
 * attestationObject's COSE_Key. Returns null when the prefix isn't
 * present (e.g. a non-ES256 credential — which we shouldn't see
 * because we only request `alg: -7`, but we still guard).
 *
 * Exported for tests; not part of the public API.
 */
export function parseEs256PublicKeyFromAttestation(attestation: Uint8Array): Uint8Array | null {
  const start = indexOfBytes(attestation, ES256_COSE_PREFIX)
  if (start < 0) return null

  const xStart = start + ES256_COSE_PREFIX.length
  const xEnd = xStart + 32
  // Skip the 3-byte `22 58 20` header between x and y.
  const yStart = xEnd + 3
  const yEnd = yStart + 32
  if (yEnd > attestation.length) return null

  const out = new Uint8Array(65)
  out[0] = 0x04
  out.set(attestation.subarray(xStart, xEnd), 1)
  out.set(attestation.subarray(yStart, yEnd), 33)
  return out
}

/**
 * Plain substring search for a byte sequence — `indexOf` for Uint8Array.
 * Used by `parseEs256PublicKeyFromAttestation`; small + correctness-
 * critical, hence inline.
 */
function indexOfBytes(haystack: Uint8Array, needle: Uint8Array): number {
  if (needle.length === 0 || needle.length > haystack.length) return -1
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer
    }
    return i
  }
  return -1
}
