-- AlterTable
ALTER TABLE "Merchant" ADD COLUMN     "onchainRegistrationRequestedAt" TIMESTAMP(3),
ADD COLUMN     "onchainRegistrationTxHash" VARCHAR(66);

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_onchainRegistrationTxHash_key" ON "Merchant"("onchainRegistrationTxHash");
