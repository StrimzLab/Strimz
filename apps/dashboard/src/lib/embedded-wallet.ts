type LinkedAccount = { type: string; walletClientType?: string; chainType?: string }

export function hasEmbeddedWallet(accounts: readonly LinkedAccount[]): boolean {
  return accounts.some(
    (a) => a.type === 'wallet' && a.walletClientType === 'privy' && a.chainType === 'ethereum',
  )
}

/** Privy only makes the wallet itself for logins through its modal; ours are headless. */
export async function ensureEmbeddedWallet(
  accounts: readonly LinkedAccount[],
  create: () => Promise<unknown>,
): Promise<'existing' | 'created'> {
  if (hasEmbeddedWallet(accounts)) return 'existing'
  await create()
  return 'created'
}
