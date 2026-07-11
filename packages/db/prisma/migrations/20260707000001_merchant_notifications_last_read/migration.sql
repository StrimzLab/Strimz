-- Add the "notifications last read" marker to the merchant record.
-- Derives dashboard unread state without a separate notification table:
-- `notification.createdAt <= notificationsLastReadAt` == read.

ALTER TABLE "Merchant" ADD COLUMN "notificationsLastReadAt" TIMESTAMP(3);
