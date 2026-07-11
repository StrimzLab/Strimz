-- AlterTable
ALTER TABLE "WebhookEvent" ADD COLUMN     "dispatchError" VARCHAR(1000),
ADD COLUMN     "dispatchedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "WebhookEvent_dispatchedAt_idx" ON "WebhookEvent"("dispatchedAt");
