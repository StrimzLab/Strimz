import { bytesToBigInt, bytesToHex, type Hex } from 'viem'

const SEQUENCE = 0x30
const INTEGER = 0x02
const BIT_STRING = 0x03

interface DerElement {
  content: Uint8Array
  end: number
}

function readElement(bytes: Uint8Array, offset: number, tag: number): DerElement {
  if (bytes[offset] !== tag) {
    throw new Error(`DER: expected tag 0x${tag.toString(16)} at byte ${offset}`)
  }
  const first = bytes[offset + 1]
  if (first === undefined) throw new Error('DER: truncated length')
  let length = first
  let start = offset + 2
  if (first & 0x80) {
    const size = first & 0x7f
    if (size === 0 || size > 2) throw new Error(`DER: unsupported length of ${size} bytes`)
    length = 0
    for (let i = 0; i < size; i += 1) {
      const byte = bytes[start + i]
      if (byte === undefined) throw new Error('DER: truncated length')
      length = (length << 8) | byte
    }
    start += size
  }
  const end = start + length
  if (end > bytes.length) throw new Error('DER: element runs past the end of the input')
  return { content: bytes.subarray(start, end), end }
}

function readSequence(bytes: Uint8Array): Uint8Array {
  const sequence = readElement(bytes, 0, SEQUENCE)
  if (sequence.end !== bytes.length) throw new Error('DER: trailing bytes after the sequence')
  return sequence.content
}

function positiveInteger(content: Uint8Array): bigint {
  const first = content[0]
  if (first === undefined) throw new Error('DER: empty integer')
  if (first & 0x80) throw new Error('DER: negative integer')
  return bytesToBigInt(content)
}

export function decodeEcdsaSignature(der: Uint8Array): { r: bigint; s: bigint } {
  const body = readSequence(der)
  const r = readElement(body, 0, INTEGER)
  const s = readElement(body, r.end, INTEGER)
  if (s.end !== body.length) throw new Error('DER: trailing bytes after s')
  return { r: positiveInteger(r.content), s: positiveInteger(s.content) }
}

export function decodeUncompressedPublicKey(spki: Uint8Array): Hex {
  const body = readSequence(spki)
  const algorithm = readElement(body, 0, SEQUENCE)
  const key = readElement(body, algorithm.end, BIT_STRING)
  if (key.end !== body.length) throw new Error('DER: trailing bytes after the public key')
  if (key.content.length !== 66 || key.content[0] !== 0x00 || key.content[1] !== 0x04) {
    throw new Error('DER: public key is not an uncompressed secp256k1 point')
  }
  return bytesToHex(key.content.subarray(1))
}
