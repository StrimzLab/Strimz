-- AlterTable
ALTER TABLE "Refund" ADD COLUMN     "customerNotifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "customerNotifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SubscriptionCharge" ADD COLUMN     "customerNotifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Refund_status_customerNotifiedAt_idx" ON "Refund"("status", "customerNotifiedAt");

-- CreateIndex
CREATE INDEX "Subscription_customerNotifiedAt_idx" ON "Subscription"("customerNotifiedAt");

-- CreateIndex
CREATE INDEX "SubscriptionCharge_status_customerNotifiedAt_idx" ON "SubscriptionCharge"("status", "customerNotifiedAt");
