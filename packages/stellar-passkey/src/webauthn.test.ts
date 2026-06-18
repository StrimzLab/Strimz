import { describe, expect, it } from 'vitest'

import { parseEs256PublicKeyFromAttestation } from './webauthn.js'

// The fixed 10-byte CBOR prefix that introduces an ES256/P-256
// COSE_Key inside the attestationObject. The 3-byte header between
// x and y is `22 58 20`.
const COSE_PREFIX = [0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20]
const Y_HEADER = [0x22, 0x58, 0x20]

function fillBytes(length: number, value: number): Uint8Array {
  const out = new Uint8Array(length)
  out.fill(value)
  return out
}

describe('parseEs256PublicKeyFromAttestation', () => {
  it('extracts a 65-byte uncompressed point with the 0x04 prefix', () => {
    const x = fillBytes(32, 0xaa)
    const y = fillBytes(32, 0xbb)
    const attestation = new Uint8Array([
      // Some random preamble — simulates the surrounding CBOR map.
      0xfb,
      0xff,
      0x00,
      ...COSE_PREFIX,
      ...x,
      ...Y_HEADER,
      ...y,
      // Trailing bytes — should be ignored.
      0x00,
      0x01,
      0x02,
    ])

    const key = parseEs256PublicKeyFromAttestation(attestation)
    expect(key).not.toBeNull()
    expect(key!.length).toBe(65)
    expect(key![0]).toBe(0x04)
    expect(Array.from(key!.subarray(1, 33))).toEqual(Array.from(x))
    expect(Array.from(key!.subarray(33, 65))).toEqual(Array.from(y))
  })

  it('returns null when the prefix is not present', () => {
    const noise = new Uint8Array(80)
    for (let i = 0; i < noise.length; i++) noise[i] = i & 0xff
    expect(parseEs256PublicKeyFromAttestation(noise)).toBeNull()
  })

  it('returns null when there is not enough data after the prefix', () => {
    // Prefix exists but the data is truncated before y completes.
    const x = fillBytes(32, 0x11)
    const attestation = new Uint8Array([
      ...COSE_PREFIX,
      ...x,
      ...Y_HEADER,
      // Missing y bytes.
    ])
    expect(parseEs256PublicKeyFromAttestation(attestation)).toBeNull()
  })
})
