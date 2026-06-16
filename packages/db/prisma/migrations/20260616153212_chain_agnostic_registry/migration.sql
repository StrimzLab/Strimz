-- CreateEnum
CREATE TYPE "ChainFamily" AS ENUM ('evm', 'stellar');

-- AlterTable
ALTER TABLE "Merchant" ADD COLUMN     "payoutAddresses" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "supportedChains" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "PaymentSession" ADD COLUMN     "acceptedChains" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "settledOn" VARCHAR(40),
ALTER COLUMN "payerWalletAddress" SET DATA TYPE VARCHAR(80);

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "approvalExpiresAt" TIMESTAMP(3),
ADD COLUMN     "chain" VARCHAR(40) NOT NULL DEFAULT 'evm:arc',
ALTER COLUMN "payerAddress" SET DATA TYPE VARCHAR(80);

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "chain" VARCHAR(40) NOT NULL DEFAULT 'evm:arc',
ALTER COLUMN "payerAddress" SET DATA TYPE VARCHAR(80),
ALTER COLUMN "merchantAddress" SET DATA TYPE VARCHAR(80);

-- CreateTable
CREATE TABLE "SupportedChain" (
    "id" VARCHAR(40) NOT NULL,
    "family" "ChainFamily" NOT NULL,
    "display" VARCHAR(40) NOT NULL,
    "iconAsset" VARCHAR(120),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "rpcConfig" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportedChain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnchainAllowance" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "chain" VARCHAR(40) NOT NULL,
    "liveUntilLedger" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "refreshedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnchainAllowance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportedChain_family_idx" ON "SupportedChain"("family");

-- CreateIndex
CREATE INDEX "SupportedChain_enabled_idx" ON "SupportedChain"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "OnchainAllowance_subscriptionId_key" ON "OnchainAllowance"("subscriptionId");

-- CreateIndex
CREATE INDEX "OnchainAllowance_expiresAt_idx" ON "OnchainAllowance"("expiresAt");

-- CreateIndex
CREATE INDEX "OnchainAllowance_chain_expiresAt_idx" ON "OnchainAllowance"("chain", "expiresAt");

-- AddForeignKey
ALTER TABLE "OnchainAllowance" ADD CONSTRAINT "OnchainAllowance_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ----------------------------------------------------------------------
-- Seed: SupportedChain registry
-- ----------------------------------------------------------------------
-- Four chains seeded at v1:
--   evm:base       — production EVM target (contract addresses
--                    populated when deploy lands)
--   evm:arc        — Arc testnet (current production-Strimz target;
--                    contracts already deployed)
--   stellar:testnet — Stellar testnet (contracts deployed at M4)
--   stellar:pubnet  — Stellar mainnet (gated on audit; enabled=false)
--
-- `rpcConfig` shape:
--   EVM:     { chainId, rpcUrlEnv, contracts: { registry, payments,
--              subscriptions, feeCollector, tokenWhitelist } }
--   Stellar: { network, horizonUrl, rpcUrl, usdcSac,
--              subscriptionContract, feeCollectorContract }
INSERT INTO "SupportedChain" ("id", "family", "display", "enabled", "rpcConfig", "createdAt", "updatedAt") VALUES
  (
    'evm:base',
    'evm',
    'Base',
    true,
    '{"chainId":8453,"rpcUrlEnv":"BASE_RPC_URL","contracts":{}}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'evm:arc',
    'evm',
    'Arc',
    true,
    '{"chainId":5042002,"rpcUrlEnv":"ARC_RPC_URL","contracts":{"registry":"0x272c7218ccceebd62a04e284091e0bc702b60e77","payments":"0x3f99a85c6b806ae55027d94bcf5165dc6e0d9ca9","subscriptions":"0xe5ff3431aa8cbb3345a8cd08f8f369f685821524","feeCollector":"0x76c01321be97b25cc6a302457e61d148761beb77","tokenWhitelist":"0x8ae2bae922b7e16a8a55dc1b583960d4c651e0f5"}}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'stellar:testnet',
    'stellar',
    'Stellar testnet',
    true,
    '{"network":"Test SDF Network ; September 2015","horizonUrl":"https://horizon-testnet.stellar.org","rpcUrl":"https://soroban-testnet.stellar.org","usdcSac":null,"subscriptionContract":null,"feeCollectorContract":null}'::jsonb,
    NOW(),
    NOW()
  ),
  (
    'stellar:pubnet',
    'stellar',
    'Stellar',
    false,
    '{"network":"Public Global Stellar Network ; September 2015","horizonUrl":"https://horizon.stellar.org","rpcUrl":"https://soroban-rpc.creit.tech","usdcSac":null,"subscriptionContract":null,"feeCollectorContract":null}'::jsonb,
    NOW(),
    NOW()
  )
ON CONFLICT ("id") DO NOTHING;

-- ----------------------------------------------------------------------
-- Backfill: existing merchants opt-in to evm:arc by default
-- ----------------------------------------------------------------------
-- Pre-multi-chain merchants implicitly targeted Arc. Seed their
-- supportedChains + payoutAddresses so the rest of the platform keeps
-- working without manual migration in the dashboard. New merchants
-- start with [] and pick at onboarding.
UPDATE "Merchant"
SET
  "supportedChains" = ARRAY['evm:arc'],
  "payoutAddresses" = jsonb_build_object('evm:arc', "payoutAddress")
WHERE
  "payoutAddress" IS NOT NULL
  AND ("supportedChains" IS NULL OR cardinality("supportedChains") = 0);

-- ----------------------------------------------------------------------
-- Backfill: PaymentSession.acceptedChains for any in-flight rows
-- ----------------------------------------------------------------------
-- Rows that pre-date this migration only knew about Arc. New sessions
-- derive acceptedChains from the merchant at create time.
UPDATE "PaymentSession"
SET "acceptedChains" = ARRAY['evm:arc']
WHERE "acceptedChains" IS NULL OR cardinality("acceptedChains") = 0;
