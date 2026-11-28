-- ADR-2026-11-28-registration-retry: keep the nonce and sender of the last registration transaction.
ALTER TABLE "Merchant" ADD COLUMN "onchainRegistrationTxNonce" INTEGER;
ALTER TABLE "Merchant" ADD COLUMN "onchainRegistrationTxFrom" VARCHAR(42);
