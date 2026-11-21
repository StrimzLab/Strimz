import { describe, expect, it } from 'vitest'

import {
  canRemovePasskey,
  passkeysOf,
  PASSKEY_OFFER_EVERY_MS,
  shouldOfferPasskey,
} from '../passkeys'

const email = { type: 'email', address: 'a@b.co' }
const google = { type: 'google_oauth', email: 'a@b.co' }
const wallet = { type: 'wallet', address: '0x1' }
const passkey = (credentialId: string, createdWithBrowser?: string) => ({
  type: 'passkey',
  credentialId,
  createdWithBrowser,
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
})

describe('shouldOfferPasskey', () => {
  const now = 10 * PASSKEY_OFFER_EVERY_MS

  it('offers to an account with no passkey that has not been asked lately', () => {
    expect(shouldOfferPasskey([email], null, now)).toBe(true)
    expect(shouldOfferPasskey([email], now - PASSKEY_OFFER_EVERY_MS - 1, now)).toBe(true)
  })

  it('waits a week after the last offer', () => {
    expect(shouldOfferPasskey([email], now - 1000, now)).toBe(false)
  })

  it('never offers to an account that has one', () => {
    expect(shouldOfferPasskey([email, passkey('p1')], null, now)).toBe(false)
  })
})
