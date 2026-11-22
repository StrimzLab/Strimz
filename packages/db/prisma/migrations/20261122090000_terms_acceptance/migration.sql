-- AlterTable
ALTER TABLE "Merchant" ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsAcceptedIp" VARCHAR(45),
ADD COLUMN     "termsVersion" VARCHAR(20);
