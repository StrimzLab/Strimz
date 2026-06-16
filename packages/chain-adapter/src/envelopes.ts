/**
 * Per-chain opaque envelopes that cross the adapter boundary.
 *
 * The port deliberately treats envelope contents as `unknown` — every
 * chain serialises its signing payload differently (EIP-712 typed
 * data, Stellar XDR base64, etc.) and we never want the business layer
 * to discriminate on it. The adapter narrows the type internally; the
 * caller passes it back to the same adapter for submission and never
 * inspects it.
 *
 * `family` is stamped so a routing layer (e.g. the BFF on the web app
 * that needs to decide which wallet flow to invoke) can dispatch
 * without parsing the envelope itself.
 */
export interface ChainEnvelope {
  /** Family that produced the envelope; same value as `adapter.family`. */
  family: 'evm' | 'stellar'
  /** Adapter-specific payload. Caller MUST NOT inspect this. */
  data: unknown
}

/**
 * Returned by `prepare*` calls. The caller hands `envelope` to the
 * payer's wallet for signing, then sends the signed result back to the
 * adapter via `submit*`.
 */
export interface PreparePaymentResult {
  /** The chain id the envelope is bound to — useful for cross-checks. */
  chainId: string
  /** Opaque per-chain bundle the wallet signs. */
  envelope: ChainEnvelope
  /** ISO-8601 expiry; the wallet must complete signing before this. */
  expiresAt: string
  /**
   * Optional hint for the checkout UI — e.g. "payer needs at least
   * 1 USDC + a USDC trustline". Adapter-specific shape, opaque to the
   * caller.
   */
  payerHint?: Record<string, unknown>
}

/** Mirror shape for subscription enrolment. */
export interface PrepareEnrolmentResult {
  chainId: string
  envelope: ChainEnvelope
  expiresAt: string
  payerHint?: Record<string, unknown>
}

/**
 * A bundle the caller produces by attaching the wallet's signature to the
 * `envelope` returned from `prepare*`. The adapter validates and submits.
 */
export interface SignedPaymentBundle {
  chainId: string
  envelope: ChainEnvelope
  /** Adapter-specific signature shape (EIP-712 v/r/s, Stellar XDR, etc.). */
  signature: unknown
}

/** Mirror shape for subscription enrolment. */
export interface SignedEnrolmentBundle {
  chainId: string
  envelope: ChainEnvelope
  signature: unknown
}
