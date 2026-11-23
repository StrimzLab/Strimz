import { describe, expect, it } from 'vitest'

import * as passkeys from '../passkeys'
import { canRemovePasskey, passkeysOf } from '../passkeys'

const email = { type: 'email', address: 'a@b.co' }
const google = { type: 'google_oauth', email: 'a@b.co' }
const wallet = { type: 'wallet', address: '0x1' }
const passkey = (credentialId: string, createdWithBrowser?: string, enrolledInMfa = false) => ({
  type: 'passkey',
  credentialId,
  createdWithBrowser,
  enrolledInMfa,
})

describe('passkeysOf', () => {
  it('lists only passkeys, named by where they were made', () => {
    expect(passkeysOf([email, passkey('p1', 'Chrome'), wallet, passkey('p2')])).toEqual([
      { credentialId: 'p1', label: 'Passkey from Chrome' },
      { credentialId: 'p2', label: 'Passkey' },
    ])
  })
})

describe('canRemovePasskey', () => {
  it('allows removal while email or Google still signs you in', () => {
    expect(canRemovePasskey([email, passkey('p1')], 'p1')).toBe(true)
    expect(canRemovePasskey([google, passkey('p1')], 'p1')).toBe(true)
  })

  it('allows removal when another passkey is left', () => {
    expect(canRemovePasskey([passkey('p1'), passkey('p2')], 'p1')).toBe(true)
  })

  it('refuses to remove the last way in; a wallet does not count', () => {
    expect(canRemovePasskey([wallet, passkey('p1')], 'p1')).toBe(false)
  })

  // The passkey step is required, so the account must keep one that confirms (#560).
  it('refuses to remove the only passkey that confirms sensitive actions', () => {
    expect(canRemovePasskey([email, passkey('p1', 'Chrome', true)], 'p1')).toBe(false)
    expect(canRemovePasskey([email, passkey('p1', 'Chrome', true), passkey('p2')], 'p1')).toBe(
      false,
    )
  })

  it('allows removing a confirming passkey while another one confirms', () => {
    expect(
      canRemovePasskey([email, passkey('p1', 'Chrome', true), passkey('p2', 'Safari', true)], 'p1'),
    ).toBe(true)
  })
})

describe('the passkey step is never throttled', () => {
  it('has no weekly offer left', () => {
    expect(Object.keys(passkeys)).not.toContain('shouldOfferPasskey')
    expect(Object.keys(passkeys)).not.toContain('notePasskeyOffer')
  })
})
