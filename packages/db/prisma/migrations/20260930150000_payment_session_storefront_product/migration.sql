-- AlterTable
ALTER TABLE "PaymentSession" ADD COLUMN     "storefrontProductId" TEXT;

-- CreateIndex
CREATE INDEX "PaymentSession_storefrontProductId_idx" ON "PaymentSession"("storefrontProductId");

-- AddForeignKey
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_storefrontProductId_fkey" FOREIGN KEY ("storefrontProductId") REFERENCES "StorefrontProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
