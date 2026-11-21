CREATE TYPE "SubscriptionCanceller" AS ENUM ('payer', 'merchant', 'strimz');

ALTER TABLE "Subscription" ADD COLUMN "cancelledBy" "SubscriptionCanceller";
