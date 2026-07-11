-- Admin-triggered broadcasts. Backed by the `Merchant.notificationsLastReadAt`
-- read-tracking mechanism used by derived notifications — no separate
-- MerchantBroadcastRead table needed. Delivery emails are sent at
-- create time and the `emailedAt` column persists the moment they
-- finished, so the ops team can audit and any future retry job has
-- a resumable checkpoint.

CREATE TYPE "BroadcastAudience" AS ENUM ('all', 'merchant');

CREATE TABLE "AdminBroadcast" (
    "id"          TEXT               NOT NULL,
    "senderId"    TEXT               NOT NULL,
    "title"       VARCHAR(160)       NOT NULL,
    "body"        TEXT               NOT NULL,
    "audience"    "BroadcastAudience" NOT NULL DEFAULT 'all',
    "merchantId"  TEXT,
    "emailedAt"   TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminBroadcast_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AdminBroadcast"
    ADD CONSTRAINT "AdminBroadcast_senderId_fkey"
    FOREIGN KEY ("senderId") REFERENCES "AdminUser"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdminBroadcast"
    ADD CONSTRAINT "AdminBroadcast_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "AdminBroadcast_audience_createdAt_idx"
    ON "AdminBroadcast"("audience", "createdAt" DESC);

CREATE INDEX "AdminBroadcast_merchantId_createdAt_idx"
    ON "AdminBroadcast"("merchantId", "createdAt" DESC);

CREATE INDEX "AdminBroadcast_senderId_createdAt_idx"
    ON "AdminBroadcast"("senderId", "createdAt" DESC);
