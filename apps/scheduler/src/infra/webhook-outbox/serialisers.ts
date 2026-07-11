import type {
  Invoice,
  PaymentCurrency,
  PaymentSession,
  Refund,
  Subscription,
  SubscriptionCharge,
  Transaction,
} from '@strimz/shared-types'

/**
 * Prisma-row → wire-schema mappers, mirroring the apps/api serialisers.
 * The dispatcher validates every built envelope against the shared Zod
 * schema, so any drift here fails loud instead of shipping a bad payload.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export function serialiseSession(row: any, usdcAddress: string | null): PaymentSession {
  return {
    id: row.id,
    merchantId: row.merchantId,
    chainMerchantId:
      row.merchant?.onchainMerchantId != null ? String(row.merchant.onchainMerchantId) : null,
    tokenAddress: row.currency === 'USDC' ? (usdcAddress?.toLowerCase() ?? null) : null,
    customerId: row.customerId,
    status: row.status,
    amount: row.amount,
    currency: row.currency,
    feeAmount: row.feeAmount,
    netAmount: row.netAmount,
    description: row.description,
    payerWalletAddress: row.payerWalletAddress,
    payerEmail: row.payerEmail,
    successUrl: row.successUrl,
    cancelUrl: row.cancelUrl,
    sourceChain: row.sourceChain,
    bridgeTxHash: row.bridgeTxHash,
    onchainTxHash: row.onchainTxHash,
    checkoutUrl: row.checkoutUrl,
    metadata: row.metadata ?? {},
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  } as PaymentSession
}

export function serialiseTransaction(row: any): Transaction {
  return {
    id: row.id,
    merchantId: row.merchantId,
    kind: row.kind,
    status: row.status,
    sessionId: row.sessionId,
    subscriptionId: row.subscriptionId,
    subscriptionChargeId: row.subscriptionChargeId,
    refundId: row.refundId,
    customerId: row.customerId,
    amount: row.amount,
    feeAmount: row.feeAmount,
    netAmount: row.netAmount,
    currency: row.currency,
    payerAddress: row.payerAddress,
    merchantAddress: row.merchantAddress,
    onchainTxHash: row.onchainTxHash,
    blockNumber: Number(row.blockNumber),
    blockTimestamp: row.blockTimestamp.toISOString(),
    createdAt: row.createdAt.toISOString(),
  } as Transaction
}

export function serialiseSubscription(row: any): Subscription {
  return {
    id: row.id,
    onchainSubscriptionId: row.onchainSubscriptionId,
    merchantId: row.merchantId,
    customerId: row.customerId,
    planId: row.planId,
    status: row.status,
    payerAddress: row.payerAddress,
    currency: row.currency,
    amount: row.amount,
    interval: row.interval,
    intervalCount: row.intervalCount,
    trialEndsAt: row.trialEndsAt?.toISOString() ?? null,
    currentPeriodStartAt: row.currentPeriodStartAt.toISOString(),
    currentPeriodEndAt: row.currentPeriodEndAt.toISOString(),
    nextChargeAt: row.nextChargeAt?.toISOString() ?? null,
    gracePeriodHours: row.gracePeriodHours,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    metadata: row.metadata ?? {},
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  } as Subscription
}

export function serialiseCharge(row: any): SubscriptionCharge {
  return {
    id: row.id,
    subscriptionId: row.subscriptionId,
    merchantId: row.merchantId,
    chargeAttemptId: row.chargeAttemptId,
    periodStartAt: row.periodStartAt.toISOString(),
    periodEndAt: row.periodEndAt.toISOString(),
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    outcome: row.outcome,
    attemptNumber: row.attemptNumber ?? 1,
    scheduledAt: row.scheduledAt.toISOString(),
    executedAt: row.executedAt?.toISOString() ?? null,
    onchainTxHash: row.onchainTxHash,
    failureReason: row.failureReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  } as SubscriptionCharge
}

export function serialiseRefund(row: any): Refund {
  return {
    id: row.id,
    merchantId: row.merchantId,
    transactionId: row.transactionId,
    amount: row.amount,
    currency: row.currency,
    reason: row.reason,
    note: row.note,
    status: row.status,
    payerAddress: row.payerAddress,
    refundTxHash: row.refundTxHash,
    failureReason: row.failureReason,
    initiatedBy: row.initiatedById,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  } as Refund
}

export function serialiseInvoice(row: any): Invoice {
  return {
    id: row.id,
    merchantId: row.merchantId,
    number: row.number,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    lineItems: row.lineItems,
    subtotal: row.subtotal,
    total: row.total,
    currency: row.currency as PaymentCurrency,
    status: row.status,
    note: row.note,
    sessionId: row.sessionId,
    dueAt: row.dueAt.toISOString(),
    paidAt: row.paidAt?.toISOString() ?? null,
    sentAt: row.sentAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  } as Invoice
}
