import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')

const page = read('app/(auth)/passkey/page.tsx')
const offer = read('components/auth/passkey-offer.tsx')
const callback = read('app/(auth)/callback/page.tsx')
const shell = read('components/dashboard/dashboard-shell.tsx')
const enrolHook = read('hooks/use-passkey-mfa.ts')

// Sign up, onboarding, passkey: the third step is required (ADR-2026-11-23-required-passkey).
describe('the passkey step', () => {
  // A passkey linked from another account's browser skipped the step without confirming (#560).
  it('leaves only once the passkey can confirm, not when one is merely linked', () => {
    expect(page).toMatch(/const enrolled = hasPasskeyMfa\(user\)/u)
    expect(page).toMatch(/else if \(enrolled\) router\.replace\(next\)/u)
  })

  it('sets up a passkey the account already has', () => {
    expect(offer).toMatch(/Use my passkey for confirmations/u)
  })

  it('has no way to skip it', () => {
    expect(page).not.toMatch(/Skip for now/u)
    expect(offer).not.toMatch(/Skip for now/u)
  })

  it('offers only sign-out where the browser cannot make passkeys', () => {
    expect(page).toMatch(/logout\(/u)
  })

  it('refreshes the user after enrolling, so the gates see the new state', () => {
    const submit = enrolHook.indexOf('submitEnrollmentWithPasskey({')
    expect(enrolHook.indexOf('refreshUser()', submit)).toBeGreaterThan(submit)
  })
})

describe('every route to the dashboard passes the passkey step', () => {
  it('sends a signed-in merchant without a confirming passkey to it', () => {
    expect(callback).toMatch(/hasPasskeyMfa\(/u)
    expect(callback).not.toMatch(/shouldOfferPasskey|lastPasskeyOffer/u)
  })

  it('gates the dashboard on it', () => {
    expect(shell).toMatch(/passkeyEnrolled: hasPasskeyMfa\(/u)
    expect(shell).toMatch(
      /gate\.kind === 'passkey'\) router\.replace\(withNext\('\/passkey', pathname\)\)/u,
    )
  })
})
