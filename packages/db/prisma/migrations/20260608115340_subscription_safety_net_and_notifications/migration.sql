-- Safety-net + email-notification fields.
--
-- Subscription.enrolmentTxHash: tx hash for the on-chain
-- permitAndCreateSubscription call. Distinct from per-period charge
-- hashes (those live on SubscriptionCharge). Backs the relay's double-
-- enrolment guard and the hosted-checkout "Subscription active" panel.
--
-- *.merchantNotifiedAt: one-shot delivery flag for the merchant-facing
-- "payment received" / "new subscriber" transactional emails. Nullable
-- timestamp; the scheduler's notification cron only picks rows where it
-- is still null. Eliminates the need for a separate notification log.

ALTER TABLE "Subscription"
    ADD COLUMN "enrolmentTxHash" VARCHAR(66),
    ADD COLUMN "merchantNotifiedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Subscription_enrolmentTxHash_key"
    ON "Subscription"("enrolmentTxHash");

ALTER TABLE "PaymentSession"
    ADD COLUMN "merchantNotifiedAt" TIMESTAMP(3);

-- Partial index supporting the notification cron: it scans confirmed
-- sessions where the email hasn't fired yet. Kept narrow so the index
-- size doesn't grow with old fully-handled rows.
CREATE INDEX "PaymentSession_status_merchantNotifiedAt_idx"
    ON "PaymentSession"("status", "merchantNotifiedAt");
