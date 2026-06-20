/**
 * Stellar-specific envelopes that the adapter surfaces inside the
 * port's `ChainEnvelope.data` field.
 *
 * The frontend signs `transactionXdr` against `networkPassphrase` via
 * `stellar-wallets-kit` (or whatever wallet the payer holds), gets a
 * signed-XDR string back, then sends `{ chainId, envelope, signature
 * }` back to the API for submission via the adapter's `submitPayment`
 * (M5c).
 *
 * The args bag is informational — surfaced so the checkout UI can
 * show "Sending 5 USDC to merchant …" without re-parsing the XDR.
 */

export interface StellarPaymentEnvelopeData {
  /** Base64-encoded `TransactionEnvelope` XDR — what the wallet signs. */
  transactionXdr: string
  /** Network passphrase the wallet must use. */
  networkPassphrase: string
  /** StrimzPayments contract id the invocation targets. */
  contractId: string
  /** Function name — always `pay` for this envelope. */
  functionName: 'pay'
  /** Strimz wire shape of the call arguments. Informational only. */
  args: {
    payer: string
    merchant: string
    asset: string
    amount: string
    feeBps: number
    /** Hex-encoded 32-byte ref id (sha-256 of `input.ref`). */
    refId: string
  }
  /** Adapter-side hint surfaced to the frontend (currently unused). */
  expiresAt: string
}

export interface StellarEnrolmentEnvelopeData {
  transactionXdr: string
  networkPassphrase: string
  contractId: string
  functionName: 'enrol'
  args: {
    payer: string
    merchant: string
    asset: string
    amountPerPeriod: string
    periodSeconds: number
    feeBps: number
    endAt: number | null
  }
  expiresAt: string
}
