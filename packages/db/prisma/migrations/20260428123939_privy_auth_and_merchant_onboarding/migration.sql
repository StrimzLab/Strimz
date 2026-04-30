-- CreateEnum
CREATE TYPE "Mode" AS ENUM ('test', 'live');

-- CreateEnum
CREATE TYPE "ArcEnvironment" AS ENUM ('testnet', 'mainnet');

-- CreateEnum
CREATE TYPE "PaymentCurrency" AS ENUM ('USDC', 'EURC');

-- CreateEnum
CREATE TYPE "TokenSymbol" AS ENUM ('USDC', 'EURC', 'USYC');

-- CreateEnum
CREATE TYPE "MerchantStatus" AS ENUM ('active', 'suspended', 'closed');

-- CreateEnum
CREATE TYPE "MerchantTier" AS ENUM ('free', 'growth', 'business', 'enterprise');

-- CreateEnum
CREATE TYPE "MerchantRole" AS ENUM ('owner', 'admin', 'developer', 'read_only');

-- CreateEnum
CREATE TYPE "ApiKeyKind" AS ENUM ('secret', 'publishable');

-- CreateEnum
CREATE TYPE "ApiKeyScope" AS ENUM ('sessions_read', 'sessions_write', 'subscriptions_read', 'subscriptions_write', 'refunds_read', 'refunds_write', 'transactions_read', 'webhooks_read', 'webhooks_write', 'invoices_read', 'invoices_write', 'storefronts_read', 'storefronts_write', 'agents_read', 'agents_write');

-- CreateEnum
CREATE TYPE "PaymentSessionStatus" AS ENUM ('created', 'awaiting_payment', 'submitted', 'confirmed', 'failed', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "SourceChain" AS ENUM ('arc', 'ethereum', 'base', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'solana');

-- CreateEnum
CREATE TYPE "TransactionKind" AS ENUM ('one_shot', 'subscription_charge', 'refund', 'invoice_payment', 'storefront_purchase');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('pending', 'confirmed', 'failed');

-- CreateEnum
CREATE TYPE "SubscriptionInterval" AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'yearly');

-- CreateEnum
CREATE TYPE "SubscriptionPlanStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'at_risk', 'paused', 'cancelled', 'lapsed');

-- CreateEnum
CREATE TYPE "SubscriptionChargeStatus" AS ENUM ('pending', 'in_flight', 'succeeded', 'failed', 'retrying', 'abandoned');

-- CreateEnum
CREATE TYPE "SubscriptionChargeOutcome" AS ENUM ('charged', 'insufficient_funds', 'revoked_approval', 'cancelled', 'skipped');

-- CreateEnum
CREATE TYPE "RefundReason" AS ENUM ('customer_request', 'product_issue', 'duplicate_charge', 'fraudulent', 'other');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('pending', 'awaiting_signature', 'submitted', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "WebhookEventName" AS ENUM ('payment_created', 'payment_completed', 'payment_failed', 'subscription_created', 'subscription_charged', 'subscription_charge_failed', 'subscription_recovery_attempt', 'subscription_recovery_outcome', 'subscription_cancelled', 'subscription_lapsed', 'refund_created', 'refund_completed', 'refund_failed', 'invoice_created', 'invoice_paid', 'invoice_overdue', 'agent_action_executed', 'agent_job_proposed', 'agent_job_completed', 'agent_job_disputed', 'compliance_wallet_flagged', 'compliance_wallet_blocked');

-- CreateEnum
CREATE TYPE "WebhookEndpointStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('pending', 'delivered', 'retrying', 'permanently_failed');

-- CreateEnum
CREATE TYPE "ComplianceProvider" AS ENUM ('trm', 'elliptic', 'disabled');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('clear', 'flagged', 'blocked', 'error');

-- CreateEnum
CREATE TYPE "ComplianceScreeningContext" AS ENUM ('merchant_onboarding', 'payer_checkout', 'subscriber_signup', 'refund_recipient');

-- CreateEnum
CREATE TYPE "AgentCapability" AS ENUM ('identity', 'recovery', 'routing', 'cashflow', 'commerce', 'pricing_intelligence');

-- CreateEnum
CREATE TYPE "AgentActionType" AS ENUM ('recovery_notification_sent', 'recovery_retry_scheduled', 'recovery_retry_executed', 'recovery_abandoned', 'routing_bridge_initiated', 'routing_payment_completed', 'cashflow_digest_sent', 'cashflow_anomaly_flagged', 'cashflow_yield_converted', 'commerce_job_created', 'commerce_job_approved', 'commerce_job_completed', 'commerce_job_disputed');

-- CreateEnum
CREATE TYPE "AgentActionOutcome" AS ENUM ('success', 'failure', 'pending', 'skipped');

-- CreateEnum
CREATE TYPE "AgentJobStatus" AS ENUM ('proposed', 'accepted', 'in_progress', 'delivered', 'approved', 'completed', 'disputed', 'cancelled');

-- CreateEnum
CREATE TYPE "StorefrontStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "StorefrontProductType" AS ENUM ('one_time', 'subscription');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'sent', 'paid', 'overdue', 'void');

-- CreateEnum
CREATE TYPE "AuditActionCategory" AS ENUM ('merchant', 'api_key', 'webhook', 'payment', 'subscription', 'refund', 'agent', 'compliance', 'auth', 'member', 'settings');

-- CreateTable
CREATE TABLE "AgentIdentity" (
    "id" TEXT NOT NULL,
    "onchainAddress" VARCHAR(42) NOT NULL,
    "credentialDigest" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "version" VARCHAR(40) NOT NULL,
    "reputationScore" INTEGER,
    "environment" "ArcEnvironment" NOT NULL DEFAULT 'testnet',
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMerchantConfig" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "enabledCapabilities" "AgentCapability"[] DEFAULT ARRAY[]::"AgentCapability"[],
    "recoveryGracePeriodHours" INTEGER NOT NULL DEFAULT 48,
    "recoveryStrategy" TEXT NOT NULL DEFAULT 'twice',
    "recoveryNotificationTemplate" VARCHAR(2000),
    "cashflowDigestEnabled" BOOLEAN NOT NULL DEFAULT false,
    "cashflowAnomalySensitivity" TEXT NOT NULL DEFAULT 'medium',
    "cashflowAutoConvertToYield" BOOLEAN NOT NULL DEFAULT false,
    "cashflowMinimumLiquidReserveCents" INTEGER NOT NULL DEFAULT 100000,
    "commerceHumanApprovalAboveUsdCents" INTEGER NOT NULL DEFAULT 100000,
    "commerceApprovedVendors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "commerceMonthlySpendCapUsdCents" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentMerchantConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentActivityLog" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "capability" "AgentCapability" NOT NULL,
    "actionType" "AgentActionType" NOT NULL,
    "outcome" "AgentActionOutcome" NOT NULL,
    "subscriptionId" TEXT,
    "transactionId" TEXT,
    "jobId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentJob" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "onchainJobId" INTEGER,
    "vendorAddress" VARCHAR(42) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "amount" VARCHAR(78) NOT NULL,
    "currency" "PaymentCurrency" NOT NULL,
    "status" "AgentJobStatus" NOT NULL DEFAULT 'proposed',
    "assessorAddress" VARCHAR(42) NOT NULL,
    "deliverableHash" TEXT,
    "escrowTxHash" VARCHAR(66),
    "releaseTxHash" VARCHAR(66),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AgentJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceLog" (
    "id" TEXT NOT NULL,
    "walletAddress" VARCHAR(42) NOT NULL,
    "provider" "ComplianceProvider" NOT NULL,
    "status" "ComplianceStatus" NOT NULL,
    "riskScore" INTEGER,
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "context" "ComplianceScreeningContext" NOT NULL,
    "merchantId" TEXT,
    "sessionId" TEXT,
    "subscriptionId" TEXT,
    "providerRequestId" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "walletAddress" VARCHAR(42) NOT NULL,
    "email" VARCHAR(320),
    "externalRef" VARCHAR(120),
    "displayName" VARCHAR(120),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "number" VARCHAR(40) NOT NULL,
    "customerName" VARCHAR(200),
    "customerEmail" VARCHAR(320),
    "lineItems" JSONB NOT NULL,
    "subtotal" VARCHAR(78) NOT NULL,
    "total" VARCHAR(78) NOT NULL,
    "currency" "PaymentCurrency" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'draft',
    "note" VARCHAR(2000),
    "sessionId" TEXT,
    "mode" "Mode" NOT NULL DEFAULT 'test',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "privyUserId" TEXT,
    "onchainMerchantId" INTEGER,
    "businessName" VARCHAR(120),
    "email" VARCHAR(320) NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "businessSector" VARCHAR(80),
    "tier" "MerchantTier" NOT NULL DEFAULT 'free',
    "status" "MerchantStatus" NOT NULL DEFAULT 'active',
    "payoutAddress" VARCHAR(42),
    "defaultCurrency" "PaymentCurrency" NOT NULL DEFAULT 'USDC',
    "countryCode" VARCHAR(2),
    "phone" VARCHAR(20),
    "websiteUrl" TEXT,
    "logoUrl" TEXT,
    "whitelabelEnabled" BOOLEAN NOT NULL DEFAULT false,
    "arcEnvironment" "ArcEnvironment" NOT NULL DEFAULT 'testnet',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantMember" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "role" "MerchantRole" NOT NULL DEFAULT 'developer',
    "invitationToken" TEXT,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "MerchantMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantApiKey" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "kind" "ApiKeyKind" NOT NULL,
    "mode" "Mode" NOT NULL,
    "hash" TEXT NOT NULL,
    "prefix" VARCHAR(24) NOT NULL,
    "lastFour" VARCHAR(4) NOT NULL,
    "scopes" "ApiKeyScope"[],
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexerCursor" (
    "contractAddress" VARCHAR(42) NOT NULL,
    "environment" "ArcEnvironment" NOT NULL,
    "lastProcessedBlock" BIGINT NOT NULL,
    "lastProcessedLogIndex" INTEGER NOT NULL DEFAULT -1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndexerCursor_pkey" PRIMARY KEY ("contractAddress")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT,
    "actorId" TEXT,
    "actorEmail" VARCHAR(320),
    "category" "AuditActionCategory" NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "targetType" VARCHAR(60) NOT NULL,
    "targetId" VARCHAR(64) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ipAddress" VARCHAR(45),
    "userAgent" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSession" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "customerId" TEXT,
    "status" "PaymentSessionStatus" NOT NULL DEFAULT 'created',
    "amount" VARCHAR(78) NOT NULL,
    "currency" "PaymentCurrency" NOT NULL,
    "feeAmount" VARCHAR(78) NOT NULL,
    "netAmount" VARCHAR(78) NOT NULL,
    "description" VARCHAR(500),
    "payerWalletAddress" VARCHAR(42),
    "payerEmail" VARCHAR(320),
    "successUrl" TEXT,
    "cancelUrl" TEXT,
    "sourceChain" "SourceChain",
    "bridgeTxHash" VARCHAR(66),
    "onchainTxHash" VARCHAR(66),
    "checkoutUrl" TEXT NOT NULL,
    "mode" "Mode" NOT NULL DEFAULT 'test',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amount" VARCHAR(78) NOT NULL,
    "currency" "PaymentCurrency" NOT NULL,
    "reason" "RefundReason" NOT NULL,
    "note" VARCHAR(500),
    "status" "RefundStatus" NOT NULL DEFAULT 'pending',
    "payerAddress" VARCHAR(42) NOT NULL,
    "refundTxHash" VARCHAR(66),
    "failureReason" VARCHAR(500),
    "initiatedById" TEXT NOT NULL,
    "mode" "Mode" NOT NULL DEFAULT 'test',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Storefront" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "slug" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(2000),
    "logoUrl" TEXT,
    "coverImageUrl" TEXT,
    "accentColor" VARCHAR(7),
    "socialLinks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "StorefrontStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Storefront_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorefrontProduct" (
    "id" TEXT NOT NULL,
    "storefrontId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(2000),
    "imageUrl" TEXT,
    "price" VARCHAR(78) NOT NULL,
    "currency" "PaymentCurrency" NOT NULL,
    "type" "StorefrontProductType" NOT NULL,
    "interval" "SubscriptionInterval",
    "intervalCount" INTEGER,
    "stock" INTEGER,
    "planId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorefrontProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "amount" VARCHAR(78) NOT NULL,
    "currency" "PaymentCurrency" NOT NULL,
    "interval" "SubscriptionInterval" NOT NULL,
    "intervalCount" INTEGER NOT NULL DEFAULT 1,
    "trialPeriodDays" INTEGER,
    "status" "SubscriptionPlanStatus" NOT NULL DEFAULT 'active',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "onchainSubscriptionId" INTEGER,
    "merchantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "payerAddress" VARCHAR(42) NOT NULL,
    "currency" "PaymentCurrency" NOT NULL,
    "amount" VARCHAR(78) NOT NULL,
    "interval" "SubscriptionInterval" NOT NULL,
    "intervalCount" INTEGER NOT NULL DEFAULT 1,
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodStartAt" TIMESTAMP(3) NOT NULL,
    "currentPeriodEndAt" TIMESTAMP(3) NOT NULL,
    "nextChargeAt" TIMESTAMP(3),
    "gracePeriodHours" INTEGER NOT NULL DEFAULT 48,
    "chargeLock" BOOLEAN NOT NULL DEFAULT false,
    "chargeLockAcquiredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" VARCHAR(500),
    "mode" "Mode" NOT NULL DEFAULT 'test',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionCharge" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "chargeAttemptId" VARCHAR(66) NOT NULL,
    "periodStartAt" TIMESTAMP(3) NOT NULL,
    "periodEndAt" TIMESTAMP(3) NOT NULL,
    "amount" VARCHAR(78) NOT NULL,
    "currency" "PaymentCurrency" NOT NULL,
    "status" "SubscriptionChargeStatus" NOT NULL DEFAULT 'pending',
    "outcome" "SubscriptionChargeOutcome",
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "onchainTxHash" VARCHAR(66),
    "failureReason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "kind" "TransactionKind" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'pending',
    "sessionId" TEXT,
    "subscriptionId" TEXT,
    "subscriptionChargeId" TEXT,
    "refundId" TEXT,
    "customerId" TEXT,
    "amount" VARCHAR(78) NOT NULL,
    "feeAmount" VARCHAR(78) NOT NULL,
    "netAmount" VARCHAR(78) NOT NULL,
    "currency" "PaymentCurrency" NOT NULL,
    "payerAddress" VARCHAR(42) NOT NULL,
    "merchantAddress" VARCHAR(42) NOT NULL,
    "onchainTxHash" VARCHAR(66) NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "blockTimestamp" TIMESTAMP(3) NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "mode" "Mode" NOT NULL DEFAULT 'test',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantWebhookEndpoint" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "mode" "Mode" NOT NULL,
    "url" TEXT NOT NULL,
    "description" VARCHAR(200),
    "events" "WebhookEventName"[],
    "status" "WebhookEndpointStatus" NOT NULL DEFAULT 'active',
    "signingSecretHash" TEXT NOT NULL,
    "signingSecretPrefix" VARCHAR(12) NOT NULL,
    "lastDeliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantWebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "type" "WebhookEventName" NOT NULL,
    "apiVersion" VARCHAR(10) NOT NULL,
    "mode" "Mode" NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventName" "WebhookEventName" NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'pending',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "responseCode" INTEGER,
    "responseMs" INTEGER,
    "responseBody" TEXT,
    "lastError" VARCHAR(1000),
    "nextAttemptAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentIdentity_onchainAddress_key" ON "AgentIdentity"("onchainAddress");

-- CreateIndex
CREATE INDEX "AgentIdentity_environment_idx" ON "AgentIdentity"("environment");

-- CreateIndex
CREATE UNIQUE INDEX "AgentMerchantConfig_merchantId_key" ON "AgentMerchantConfig"("merchantId");

-- CreateIndex
CREATE INDEX "AgentActivityLog_merchantId_createdAt_idx" ON "AgentActivityLog"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentActivityLog_capability_actionType_idx" ON "AgentActivityLog"("capability", "actionType");

-- CreateIndex
CREATE UNIQUE INDEX "AgentJob_onchainJobId_key" ON "AgentJob"("onchainJobId");

-- CreateIndex
CREATE INDEX "AgentJob_merchantId_status_idx" ON "AgentJob"("merchantId", "status");

-- CreateIndex
CREATE INDEX "AgentJob_status_createdAt_idx" ON "AgentJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ComplianceLog_walletAddress_createdAt_idx" ON "ComplianceLog"("walletAddress", "createdAt");

-- CreateIndex
CREATE INDEX "ComplianceLog_status_idx" ON "ComplianceLog"("status");

-- CreateIndex
CREATE INDEX "ComplianceLog_merchantId_createdAt_idx" ON "ComplianceLog"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "Customer_merchantId_lastSeenAt_idx" ON "Customer"("merchantId", "lastSeenAt");

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_externalRef_idx" ON "Customer"("externalRef");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_merchantId_walletAddress_key" ON "Customer"("merchantId", "walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_sessionId_key" ON "Invoice"("sessionId");

-- CreateIndex
CREATE INDEX "Invoice_merchantId_status_idx" ON "Invoice"("merchantId", "status");

-- CreateIndex
CREATE INDEX "Invoice_merchantId_dueAt_idx" ON "Invoice"("merchantId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_merchantId_number_key" ON "Invoice"("merchantId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_privyUserId_key" ON "Merchant"("privyUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_onchainMerchantId_key" ON "Merchant"("onchainMerchantId");

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_email_key" ON "Merchant"("email");

-- CreateIndex
CREATE INDEX "Merchant_status_idx" ON "Merchant"("status");

-- CreateIndex
CREATE INDEX "Merchant_tier_idx" ON "Merchant"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantMember_invitationToken_key" ON "MerchantMember"("invitationToken");

-- CreateIndex
CREATE INDEX "MerchantMember_merchantId_idx" ON "MerchantMember"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantMember_merchantId_email_key" ON "MerchantMember"("merchantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantApiKey_hash_key" ON "MerchantApiKey"("hash");

-- CreateIndex
CREATE INDEX "MerchantApiKey_merchantId_mode_idx" ON "MerchantApiKey"("merchantId", "mode");

-- CreateIndex
CREATE INDEX "MerchantApiKey_revokedAt_idx" ON "MerchantApiKey"("revokedAt");

-- CreateIndex
CREATE INDEX "IndexerCursor_environment_idx" ON "IndexerCursor"("environment");

-- CreateIndex
CREATE INDEX "AuditLog_merchantId_createdAt_idx" ON "AuditLog"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_category_createdAt_idx" ON "AuditLog"("category", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "PaymentSession_merchantId_status_idx" ON "PaymentSession"("merchantId", "status");

-- CreateIndex
CREATE INDEX "PaymentSession_merchantId_createdAt_idx" ON "PaymentSession"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentSession_onchainTxHash_idx" ON "PaymentSession"("onchainTxHash");

-- CreateIndex
CREATE INDEX "PaymentSession_status_expiresAt_idx" ON "PaymentSession"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_refundTxHash_key" ON "Refund"("refundTxHash");

-- CreateIndex
CREATE INDEX "Refund_merchantId_status_idx" ON "Refund"("merchantId", "status");

-- CreateIndex
CREATE INDEX "Refund_merchantId_createdAt_idx" ON "Refund"("merchantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Storefront_merchantId_key" ON "Storefront"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "Storefront_slug_key" ON "Storefront"("slug");

-- CreateIndex
CREATE INDEX "Storefront_status_idx" ON "Storefront"("status");

-- CreateIndex
CREATE INDEX "StorefrontProduct_storefrontId_isActive_sortOrder_idx" ON "StorefrontProduct"("storefrontId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_merchantId_status_idx" ON "SubscriptionPlan"("merchantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_onchainSubscriptionId_key" ON "Subscription"("onchainSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_merchantId_status_idx" ON "Subscription"("merchantId", "status");

-- CreateIndex
CREATE INDEX "Subscription_nextChargeAt_status_idx" ON "Subscription"("nextChargeAt", "status");

-- CreateIndex
CREATE INDEX "Subscription_customerId_idx" ON "Subscription"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionCharge_chargeAttemptId_key" ON "SubscriptionCharge"("chargeAttemptId");

-- CreateIndex
CREATE INDEX "SubscriptionCharge_subscriptionId_attemptNumber_idx" ON "SubscriptionCharge"("subscriptionId", "attemptNumber");

-- CreateIndex
CREATE INDEX "SubscriptionCharge_status_scheduledAt_idx" ON "SubscriptionCharge"("status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_sessionId_key" ON "Transaction"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_subscriptionChargeId_key" ON "Transaction"("subscriptionChargeId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_refundId_key" ON "Transaction"("refundId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_onchainTxHash_key" ON "Transaction"("onchainTxHash");

-- CreateIndex
CREATE INDEX "Transaction_merchantId_kind_blockTimestamp_idx" ON "Transaction"("merchantId", "kind", "blockTimestamp");

-- CreateIndex
CREATE INDEX "Transaction_merchantId_status_idx" ON "Transaction"("merchantId", "status");

-- CreateIndex
CREATE INDEX "Transaction_customerId_idx" ON "Transaction"("customerId");

-- CreateIndex
CREATE INDEX "Transaction_payerAddress_idx" ON "Transaction"("payerAddress");

-- CreateIndex
CREATE INDEX "Transaction_blockNumber_idx" ON "Transaction"("blockNumber");

-- CreateIndex
CREATE INDEX "MerchantWebhookEndpoint_merchantId_mode_status_idx" ON "MerchantWebhookEndpoint"("merchantId", "mode", "status");

-- CreateIndex
CREATE INDEX "WebhookEvent_merchantId_type_createdAt_idx" ON "WebhookEvent"("merchantId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_merchantId_mode_createdAt_idx" ON "WebhookEvent"("merchantId", "mode", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookDelivery_deliveryId_key" ON "WebhookDelivery"("deliveryId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_status_nextAttemptAt_idx" ON "WebhookDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_merchantId_createdAt_idx" ON "WebhookDelivery"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_eventId_idx" ON "WebhookDelivery"("eventId");

-- AddForeignKey
ALTER TABLE "AgentMerchantConfig" ADD CONSTRAINT "AgentMerchantConfig_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentActivityLog" ADD CONSTRAINT "AgentActivityLog_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentJob" ADD CONSTRAINT "AgentJob_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceLog" ADD CONSTRAINT "ComplianceLog_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PaymentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantMember" ADD CONSTRAINT "MerchantMember_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantApiKey" ADD CONSTRAINT "MerchantApiKey_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Storefront" ADD CONSTRAINT "Storefront_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorefrontProduct" ADD CONSTRAINT "StorefrontProduct_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "Storefront"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPlan" ADD CONSTRAINT "SubscriptionPlan_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionCharge" ADD CONSTRAINT "SubscriptionCharge_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionCharge" ADD CONSTRAINT "SubscriptionCharge_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PaymentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_subscriptionChargeId_fkey" FOREIGN KEY ("subscriptionChargeId") REFERENCES "SubscriptionCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantWebhookEndpoint" ADD CONSTRAINT "MerchantWebhookEndpoint_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "MerchantWebhookEndpoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "WebhookEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
