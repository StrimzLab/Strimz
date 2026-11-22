/** The relayer's signer. Modules depend on this token, never on a concrete provider. */
export const KMS_SIGNER = Symbol('KMS_SIGNER')

/** Privy's wallet API; null unless KMS_PROVIDER=privy. Overridden in tests. */
export const PRIVY_WALLET_API = Symbol('PRIVY_WALLET_API')
