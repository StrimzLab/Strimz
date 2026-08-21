-- Audit remediation + retry backoff.
--
-- 1. AgentJobStatus gains `funded`, `resolved`, `reclaimed`. The escrow's
--    dispute-resolution and timeout-reclaim paths are the only exits from
--    a disputed or abandoned job; without these values such jobs can never
--    reach a terminal off-chain status.
-- 2. SubscriptionChargeOutcome is split per contract ChargeOutcome. Every
--    non-billing outcome previously collapsed into `skipped`, so a
--    retryable failure was indistinguishable from a terminal one.
-- 3. Subscription gains retry-backoff state.
--
-- Enum values are added positionally so the physical order matches the
-- Prisma schema and no drift is reported on the next introspection.

-- AlterEnum
ALTER TYPE "AgentJobStatus" ADD VALUE 'funded' AFTER 'accepted';
ALTER TYPE "AgentJobStatus" ADD VALUE 'resolved' AFTER 'cancelled';
ALTER TYPE "AgentJobStatus" ADD VALUE 'reclaimed' AFTER 'resolved';

-- AlterEnum
ALTER TYPE "SubscriptionChargeOutcome" ADD VALUE 'not_due' AFTER 'cancelled';
ALTER TYPE "SubscriptionChargeOutcome" ADD VALUE 'ended' AFTER 'not_due';
ALTER TYPE "SubscriptionChargeOutcome" ADD VALUE 'duplicate' AFTER 'ended';
ALTER TYPE "SubscriptionChargeOutcome" ADD VALUE 'unknown' AFTER 'duplicate';
ALTER TYPE "SubscriptionChargeOutcome" ADD VALUE 'merchant_inactive' AFTER 'unknown';
ALTER TYPE "SubscriptionChargeOutcome" ADD VALUE 'transfer_failed' AFTER 'merchant_inactive';

-- AlterTable
ALTER TABLE "Subscription"
  ADD COLUMN "retryCount"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextRetryAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Subscription_nextChargeAt_nextRetryAt_status_idx"
  ON "Subscription"("nextChargeAt", "nextRetryAt", "status");
