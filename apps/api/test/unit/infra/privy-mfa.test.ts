import type { User } from '@privy-io/server-auth'
import { describe, expect, it } from 'vitest'
import { PrivyService } from '../../../src/infra/privy/privy.service.js'

// Shaped like @privy-io/server-auth's getUser(): MFA lives on the passkey account, and
// there is no top-level mfaMethods.
function user(
  passkeys: Array<{ enrolledInMfa: boolean }>,
  login: 'google' | 'email' | 'none' = 'google',
): User {
  const google = { type: 'google_oauth', subject: 's', email: 'a@b.co', name: null }
  const email = { type: 'email', address: 'a@b.co' }
  return {
    ...(login === 'email' ? { email: { address: 'a@b.co' } } : {}),
    ...(login === 'google' ? { google } : {}),
    id: 'did:privy:test',
    createdAt: new Date(0),
    isGuest: false,
    customMetadata: {},
    linkedAccounts: [
      ...(login === 'google' ? [google] : []),
      ...(login === 'email' ? [email] : []),
      ...passkeys.map((p, i) => ({ type: 'passkey', credentialId: `c${i}`, ...p })),
    ],
  } as unknown as User
}

const privy = Object.create(PrivyService.prototype) as PrivyService

describe('Privy MFA checks (#548)', () => {
  it('sees a passkey enrolled for MFA', () => {
    expect(privy.hasPasskeyMfa(user([{ enrolledInMfa: true }]))).toBe(true)
    expect(privy.hasMfa(user([{ enrolledInMfa: true }]))).toBe(true)
  })

  it('ignores a passkey used only for sign-in', () => {
    expect(privy.hasPasskeyMfa(user([{ enrolledInMfa: false }]))).toBe(false)
    expect(privy.hasMfa(user([{ enrolledInMfa: false }]))).toBe(false)
  })

  it('sees no MFA without a passkey', () => {
    expect(privy.hasPasskeyMfa(user([]))).toBe(false)
    expect(privy.hasMfa(user([]))).toBe(false)
  })
})

describe('verified email (Google sign-ins)', () => {
  it('counts an email-code login as verified', () => {
    expect(privy.hasVerifiedEmail(user([], 'email'))).toBe(true)
  })

  it('counts a Google sign-in as verified, since Google verifies the address', () => {
    expect(privy.hasVerifiedEmail(user([], 'google'))).toBe(true)
  })

  it('does not count an account with no email login', () => {
    expect(privy.hasVerifiedEmail(user([{ enrolledInMfa: true }], 'none'))).toBe(false)
  })
})
