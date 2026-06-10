-- Adds one-shot notification-stamp columns for two more email cron paths:
--   1. Merchant.welcomeNotifiedAt — drives the welcome email cron.
--   2. SubscriptionCharge.merchantNotifiedAt — drives the recurring-
--      charge notification cron (fires after status flips to succeeded).
--
-- Same pattern already in PaymentSession.merchantNotifiedAt and
-- Subscription.merchantNotifiedAt: NULL = un-sent, NON-NULL = sent.
-- Cron polls NULL rows, sends, stamps. Guarantees one-shot delivery
-- without a separate event log.

ALTER TABLE "Merchant"
    ADD COLUMN "welcomeNotifiedAt" TIMESTAMP(3);

CREATE INDEX "Merchant_welcomeNotifiedAt_idx"
    ON "Merchant"("welcomeNotifiedAt");

ALTER TABLE "SubscriptionCharge"
    ADD COLUMN "merchantNotifiedAt" TIMESTAMP(3);

CREATE INDEX "SubscriptionCharge_status_merchantNotifiedAt_idx"
    ON "SubscriptionCharge"("status", "merchantNotifiedAt");
