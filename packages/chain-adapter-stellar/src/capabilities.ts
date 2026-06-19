/**
 * Static capability flags for the Stellar family. Same constant is
 * returned from every `StellarChainAdapter` instance — capabilities
 * are family-wide, not network-specific. Testnet vs pubnet differ
 * only in the network identifier + contract addresses, not in what
 * operations are possible.
 *
 * These flags are read in cross-cutting code (apps/web checkout,
 * scheduler dunning lane) so feature gating doesn't have to branch on
 * chain id literals.
 */

import type { ChainCapabilities } from '@strimz/chain-adapter'

export const STELLAR_CAPABILITIES: ChainCapabilities = {
  // Stellar's gas abstraction is `FeeBumpTransactionEnvelope` (CAP-15):
  // an outer transaction whose `feeSource` pays the fee for an inner
  // tx signed by a separate `sourceAccount`. The Strimz relayer wraps
  // payer-signed inner txs in a fee-bump on the way out so payers
  // never have to hold XLM for gas.
  feeAbstraction: 'fee-bump',

  // SEP-41 token contracts implement `approve(from, spender,
  // amount, live_until_ledger)`. Unlike EIP-2612, the allowance has
  // a hard ledger-bound expiry — once `live_until_ledger` passes the
  // approval evaporates regardless of remaining balance. This is the
  // single biggest semantic delta from the EVM adapter.
  permitStyle: 'sep-41-approve',
  permitHasExpiry: true,

  // Both stablecoins live on Stellar via Circle:
  //  - USDC: issued classic; SAC wraps it for contract use.
  //  - EURC: same shape, also issued by Circle.
  multiCurrency: ['USDC', 'EURC'],

  // BeginSponsoringFutureReserves lets Strimz pay the trustline + base
  // reserve for new payers in a sandwich op, so a payer with zero XLM
  // can still receive USDC and authorise the payment.
  supportsSponsoredReserves: true,

  // SEP-41 `transfer(payer, anywhere, amount)` accepts any recipient
  // address — no chain-side restriction on third-party refund targets.
  supportsRefundsToThirdParty: true,
}
