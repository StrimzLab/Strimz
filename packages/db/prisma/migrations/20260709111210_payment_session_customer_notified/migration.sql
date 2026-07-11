-- AlterTable
ALTER TABLE "PaymentSession" ADD COLUMN     "customerNotifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "PaymentSession_status_customerNotifiedAt_idx" ON "PaymentSession"("status", "customerNotifiedAt");
