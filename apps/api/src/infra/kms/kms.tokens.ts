/**
 * Nest DI tokens for the KMS layer.
 *
 * Modules consume the abstract `KmsSigner` via the `KMS_SIGNER` token
 * rather than depending on a concrete class. The active provider is
 * selected at module-construction time from the `KMS_PROVIDER` env var.
 */
export const KMS_SIGNER = Symbol('KMS_SIGNER')
