interface AccountLike {
  type: string
  credentialId?: string
  createdWithBrowser?: string
  enrolledInMfa?: boolean
}

const SIGN_IN_TYPES = new Set(['email', 'google_oauth', 'passkey'])

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

/** False when removing it would leave no way to sign in, or no passkey that confirms. */
export function canRemovePasskey(accounts: readonly AccountLike[], credentialId: string): boolean {
  const others = accounts.filter((a) => !(a.type === 'passkey' && a.credentialId === credentialId))
  const removed = accounts.find((a) => a.type === 'passkey' && a.credentialId === credentialId)
  if (removed?.enrolledInMfa && !others.some((a) => a.type === 'passkey' && a.enrolledInMfa)) {
    return false
  }
  return others.some((a) => SIGN_IN_TYPES.has(a.type))
}
