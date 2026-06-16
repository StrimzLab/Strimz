/**
 * Static feature flags for the EVM family. Same constant is returned
 * from every EvmChainAdapter instance — capabilities are family-wide,
 * not chain-specific. If a future chain in this family differs (e.g.
 * an L2 that doesn't expose EIP-2612 on its USDC), branch in the
 * adapter constructor and override.
 */

import type { ChainCapabilities } from '@strimz/chain-adapter'

export const EVM_CAPABILITIES: ChainCapabilities = {
  // Merchant pays gas on the payer's behalf via the relayer in apps/api
  // (ERC-2771-style; the typed-data signature comes from the payer,
  // the broadcast happens from the relayer EOA).
  feeAbstraction: 'meta-tx',

  // EIP-2612 permits are signature-only, no on-chain expiry.
  permitStyle: 'eip-2612',
  permitHasExpiry: false,

  // Both stablecoins are on every EVM chain Strimz currently targets.
  // Per-chain token addresses live in the adapter config.
  multiCurrency: ['USDC', 'EURC'],

  // EVM has no equivalent to Stellar's BeginSponsoringFutureReserves;
  // the merchant doesn't underwrite a payer's account creation.
  supportsSponsoredReserves: false,

  // ERC-20 transfers go to any address; nothing chain-specific gating
  // a refund's recipient.
  supportsRefundsToThirdParty: true,
}
