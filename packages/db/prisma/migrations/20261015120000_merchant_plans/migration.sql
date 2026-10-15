CREATE TYPE "MerchantTier_new" AS ENUM ('free', 'starter', 'growth', 'enterprise');

ALTER TABLE "Merchant" ALTER COLUMN "tier" DROP DEFAULT;

ALTER TABLE "Merchant" ALTER COLUMN "tier" TYPE "MerchantTier_new" USING (
  CASE "tier"::text
    WHEN 'growth' THEN 'starter'
    WHEN 'business' THEN 'growth'
    ELSE "tier"::text
  END
)::"MerchantTier_new";

DROP TYPE "MerchantTier";

ALTER TYPE "MerchantTier_new" RENAME TO "MerchantTier";

ALTER TABLE "Merchant" ALTER COLUMN "tier" SET DEFAULT 'free';
