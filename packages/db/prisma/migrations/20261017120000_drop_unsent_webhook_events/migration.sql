-- Nothing ever sent these three, so no event or delivery row holds them.
UPDATE "MerchantWebhookEndpoint"
   SET "events" = array_remove(array_remove(array_remove("events",
         'subscription_recovery_outcome'), 'refund_failed'), 'agent_action_executed')
 WHERE "events" && ARRAY['subscription_recovery_outcome', 'refund_failed', 'agent_action_executed']::"WebhookEventName"[];

-- An endpoint left with no events never received a delivery.
DELETE FROM "MerchantWebhookEndpoint" WHERE cardinality("events") = 0;

CREATE TYPE "WebhookEventName_new" AS ENUM ('payment_created', 'payment_completed', 'payment_failed', 'subscription_created', 'subscription_charged', 'subscription_charge_failed', 'subscription_recovery_attempt', 'subscription_cancelled', 'subscription_lapsed', 'refund_created', 'refund_completed', 'invoice_created', 'invoice_paid', 'invoice_overdue', 'agent_job_proposed', 'agent_job_completed', 'agent_job_disputed', 'compliance_wallet_flagged', 'compliance_wallet_blocked');

ALTER TABLE "MerchantWebhookEndpoint" ALTER COLUMN "events" TYPE "WebhookEventName_new"[] USING ("events"::text[]::"WebhookEventName_new"[]);

ALTER TABLE "WebhookEvent" ALTER COLUMN "type" TYPE "WebhookEventName_new" USING ("type"::text::"WebhookEventName_new");

ALTER TABLE "WebhookDelivery" ALTER COLUMN "eventName" TYPE "WebhookEventName_new" USING ("eventName"::text::"WebhookEventName_new");

DROP TYPE "WebhookEventName";

ALTER TYPE "WebhookEventName_new" RENAME TO "WebhookEventName";
