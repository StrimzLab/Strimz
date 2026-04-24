/**
 * Constant-time comparison.
 *
 * The comparison must not short-circuit on the first byte mismatch, or an
 * attacker can infer the correct value byte by byte from response timings.
 *
 * Length-difference side channels are acceptable here: leaking the length of
 * a MAC tells an attacker nothing useful (both values are fixed-size in our
 * use).
 */

export function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= (a[i] as number) ^ (b[i] as number)
  }
  return diff === 0
}

export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}
