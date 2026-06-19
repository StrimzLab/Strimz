-- Reshape Stellar SupportedChain.rpcConfig to match the
-- StellarChainAdapter's expected JSON envelope. Two changes:
--
--   1. `network` switches from the full passphrase string to the
--      adapter-side identifier (`testnet` / `pubnet`). The passphrase
--      is reconstructed inside the adapter via NETWORK_PASSPHRASE.
--   2. Contract addresses move under a nested `contracts: { payments,
--      subscription, feeCollector }` object — same shape as the EVM
--      rpcConfig. The legacy top-level `subscriptionContract` +
--      `feeCollectorContract` are dropped.
--
-- Pre-state (seeded in 20260616153212_chain_agnostic_registry):
--   { network: "Test SDF Network ; September 2015",
--     horizonUrl: …, rpcUrl: …, usdcSac: null,
--     subscriptionContract: null, feeCollectorContract: null }
--
-- Post-state:
--   { network: "testnet",
--     horizonUrl: …, rpcUrl: …, usdcSac: null,
--     contracts: { payments: "", subscription: "", feeCollector: "" } }
--
-- `contracts.*` stay empty strings until the M4 Soroban WASM lands on
-- testnet — the adapter skips registration while they're empty and
-- logs a warn so the operator surface stays visible.

UPDATE "SupportedChain"
SET "rpcConfig" = jsonb_build_object(
  'network', 'testnet',
  'horizonUrl', "rpcConfig" -> 'horizonUrl',
  'rpcUrl', "rpcConfig" -> 'rpcUrl',
  'usdcSac', "rpcConfig" -> 'usdcSac',
  'contracts', jsonb_build_object(
    'payments', '',
    'subscription', '',
    'feeCollector', ''
  )
)
WHERE "id" = 'stellar:testnet';

UPDATE "SupportedChain"
SET "rpcConfig" = jsonb_build_object(
  'network', 'pubnet',
  'horizonUrl', "rpcConfig" -> 'horizonUrl',
  'rpcUrl', "rpcConfig" -> 'rpcUrl',
  'usdcSac', "rpcConfig" -> 'usdcSac',
  'contracts', jsonb_build_object(
    'payments', '',
    'subscription', '',
    'feeCollector', ''
  )
)
WHERE "id" = 'stellar:pubnet';
