/**
 * Byte encoders that work in every JavaScript runtime we target.
 * No Node `Buffer`, no dependency on the DOM. Only Uint8Array, strings, and
 * the two TextEncoder/TextDecoder classes available everywhere.
 */

const HEX_CHARS = '0123456789abcdef'

export function toHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] as number
    out += HEX_CHARS[b >>> 4]
    out += HEX_CHARS[b & 0x0f]
  }
  return out
}

export function fromHex(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  if (clean.length % 2 !== 0) {
    throw new Error('fromHex: odd-length hex input')
  }
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(clean.substr(i * 2, 2), 16)
    if (Number.isNaN(byte)) {
      throw new Error('fromHex: non-hex character')
    }
    out[i] = byte
  }
  return out
}

export function toBase64Url(bytes: Uint8Array): string {
  // Build a binary string without spreading (spread can overflow on large arrays).
  // `btoa` is global in Node 16+, all Edge runtimes, and browsers.
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] as number)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function utf8ToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str)
}

export function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}
