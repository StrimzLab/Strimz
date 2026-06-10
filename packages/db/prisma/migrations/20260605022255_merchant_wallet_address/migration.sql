-- AlterTable
ALTER TABLE "Merchant" ADD COLUMN     "walletAddress" VARCHAR(42);

-- Backfill from payoutAddress for any existing rows: the prior code path
-- conflated the merchant's controlling wallet (now `walletAddress`) with
-- the payout target. New rows get both written separately from `auth/sync`.
UPDATE "Merchant" SET "walletAddress" = "payoutAddress" WHERE "walletAddress" IS NULL AND "payoutAddress" IS NOT NULL;
