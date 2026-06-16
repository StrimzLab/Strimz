/**
 * Declarative feature flags per chain. Lets call sites adjust UX without
 * hard-coding chain names — e.g. "show the trustline prompt only when
 * `capabilities.supportsSponsoredReserves`" rather than `if (family ===
 * 'stellar')`.
 *
 * Capabilities are stable for the lifetime of an adapter; they describe
 * what the chain can do, not how a specific session is configured.
 */
export interface ChainCapabilities {
  /**
   * How a merchant pays gas on behalf of a payer.
   *
   * - `meta-tx` — the payer signs a typed-data authorisation; the
   *   merchant's relayer broadcasts the tx and pays the gas (EVM
   *   pattern: EIP-3009 + ERC-2771-style relayer).
   * - `fee-bump` — the payer signs an inner transaction; the merchant
   *   wraps it in a `FeeBumpTransactionEnvelope` and pays the fee
   *   (Stellar pattern, CAP-0015).
   */
  feeAbstraction: 'meta-tx' | 'fee-bump'

  /**
   * Permit / approval primitive the chain supports for recurring pulls.
   *
   * - `eip-2612` — ERC-20 permit. Signature-based, indefinite by
   *   default; revoke = re-approve(spender, 0).
   * - `sep-41-approve` — Soroban token approval with a mandatory
   *   `live_until_ledger` expiry. Drives the renewal dunning lane.
   */
  permitStyle: 'eip-2612' | 'sep-41-approve'

  /**
   * True when the chain's permit primitive carries a hard expiry.
   * Drives the "re-authorise" reminder lane in apps/scheduler.
   * Stellar = true; EVM = false (permits don't auto-expire).
   */
  permitHasExpiry: boolean

  /**
   * Tokens settled on this chain. Currency strings match
   * `PaymentCurrency` in `@strimz/shared-types` — keep these in lockstep.
   * Concrete addresses (or Soroban Asset Contract handles) live in the
   * adapter config, not here.
   */
  multiCurrency: ReadonlyArray<'USDC' | 'EURC'>

  /**
   * True when account A can pay the storage / minimum-balance reserve
   * for account B (Stellar's `BeginSponsoringFutureReserves`). Lets the
   * frontend hide the "make sure you have 1 XLM" prompt for new payers
   * paying via classic accounts.
   */
  supportsSponsoredReserves: boolean

  /**
   * True when the chain natively supports refunding to a different
   * address than the original payer. Both EVM and Stellar do, but this
   * is here so a future custodial chain can opt out cleanly.
   */
  supportsRefundsToThirdParty: boolean
}
