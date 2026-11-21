interface AccountLike {
  type: string
  credentialId?: string
  createdWithBrowser?: string
}

const SIGN_IN_TYPES = new Set(['email', 'google_oauth', 'passkey'])

export const PASSKEY_OFFER_EVERY_MS = 7 * 24 * 60 * 60 * 1000

export function passkeysOf(accounts: readonly AccountLike[]) {
  return accounts
    .filter(
      (a): a is AccountLike & { credentialId: string } =>
        a.type === 'passkey' && Boolean(a.credentialId),
    )
    .map((a) => ({
      credentialId: a.credentialId,
      label: a.createdWithBrowser ? `Passkey from ${a.createdWithBrowser}` : 'Passkey',
    }))
}

/** False when removing it would leave no way to sign in. */
export function canRemovePasskey(accounts: readonly AccountLike[], credentialId: string): boolean {
  return accounts.some(
    (a) => SIGN_IN_TYPES.has(a.type) && !(a.type === 'passkey' && a.credentialId === credentialId),
  )
}

export function shouldOfferPasskey(
  accounts: readonly AccountLike[],
  lastOfferedAt: number | null,
  now = Date.now(),
): boolean {
  if (accounts.some((a) => a.type === 'passkey')) return false
  return lastOfferedAt === null || now - lastOfferedAt > PASSKEY_OFFER_EVERY_MS
}

const OFFERED_KEY = 'strimz:passkey-offered-at'

function localStore(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return window.localStorage
  } catch {
    // Blocked storage only means the offer may come back sooner.
    return null
  }
}

export function lastPasskeyOffer(store = localStore()): number | null {
  const raw = store?.getItem(OFFERED_KEY)
  const at = raw ? Number(raw) : NaN
  return Number.isFinite(at) ? at : null
}

export function notePasskeyOffer(store = localStore(), now = Date.now()): void {
  store?.setItem(OFFERED_KEY, String(now))
}
