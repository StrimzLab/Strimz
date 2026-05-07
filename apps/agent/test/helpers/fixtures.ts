import type { PrismaClient } from '@strimz/db'

/* eslint-disable @typescript-eslint/no-explicit-any */

let counter = 0
const nextId = (prefix: string): string =>
  `${prefix}_${(counter++).toString(36)}_${Math.random().toString(36).slice(2, 8)}`

export async function seedMerchant(
  prisma: PrismaClient,
  overrides: Partial<{
    id: string
    email: string
    businessName: string
    payoutAddress: string
  }> = {},
): Promise<any> {
  const id = overrides.id ?? nextId('m')
  return prisma.merchant.create({
    data: {
      id,
      privyUserId: `did:privy:e2e:${id}`,
      email: overrides.email ?? `${id}@strimz.test`,
      businessName: overrides.businessName ?? `Acme ${id}`,
      payoutAddress: overrides.payoutAddress ?? '0x000000000000000000000000000000000000beef',
      emailVerified: true,
    },
  })
}

export async function seedAgentConfig(
  prisma: PrismaClient,
  merchantId: string,
  overrides: Partial<{
    enabledCapabilities: string[]
    recoveryStrategy: string
    cashflowDigestEnabled: boolean
    cashflowAnomalySensitivity: 'low' | 'medium' | 'high'
    cashflowAutoConvertToYield: boolean
    cashflowMinimumLiquidReserveCents: number
    commerceMonthlySpendCapUsdCents: number | null
  }> = {},
): Promise<any> {
  return prisma.agentMerchantConfig.create({
    data: {
      merchantId,
      enabledCapabilities: (overrides.enabledCapabilities ?? []) as never,
      recoveryStrategy: overrides.recoveryStrategy ?? 'twice',
      cashflowDigestEnabled: overrides.cashflowDigestEnabled ?? false,
      cashflowAnomalySensitivity: overrides.cashflowAnomalySensitivity ?? 'medium',
      cashflowAutoConvertToYield: overrides.cashflowAutoConvertToYield ?? false,
      cashflowMinimumLiquidReserveCents: overrides.cashflowMinimumLiquidReserveCents ?? 100_000,
      commerceMonthlySpendCapUsdCents: overrides.commerceMonthlySpendCapUsdCents ?? null,
    },
  })
}

export async function seedSubscription(
  prisma: PrismaClient,
  merchantId: string,
  overrides: Partial<{
    customerEmail: string
    payerAddress: string
    status: 'active' | 'at_risk' | 'cancelled' | 'lapsed'
    currentPeriodEndAt: Date
  }> = {},
): Promise<any> {
  const customer = await prisma.customer.create({
    data: {
      merchantId,
      walletAddress:
        overrides.payerAddress ??
        '0x' + Math.random().toString(16).slice(2).padEnd(40, '0').slice(0, 40),
      email: overrides.customerEmail ?? `customer-${nextId('c')}@buyer.test`,
    },
  })
  const plan = await prisma.subscriptionPlan.create({
    data: {
      merchantId,
      name: 'Plan',
      amount: '20000000',
      currency: 'USDC',
      interval: 'monthly',
      intervalCount: 1,
    },
  })
  const now = new Date()
  return prisma.subscription.create({
    data: {
      merchantId,
      customerId: customer.id,
      planId: plan.id,
      status: (overrides.status ?? 'at_risk') as never,
      payerAddress: customer.walletAddress,
      currency: 'USDC',
      amount: '20000000',
      interval: 'monthly',
      intervalCount: 1,
      currentPeriodStartAt: new Date(now.getTime() - 60 * 24 * 60 * 60_000),
      currentPeriodEndAt: overrides.currentPeriodEndAt ?? new Date(now.getTime() - 60_000),
      gracePeriodHours: 48,
      mode: 'test',
    },
  })
}

export async function seedTransaction(
  prisma: PrismaClient,
  merchantId: string,
  overrides: Partial<{
    amount: string
    netAmount: string
    feeAmount: string
    customerId: string
    blockTimestamp: Date
    kind: 'one_shot' | 'subscription_charge' | 'refund'
    status: 'pending' | 'confirmed' | 'failed'
  }> = {},
): Promise<any> {
  return prisma.transaction.create({
    data: {
      merchantId,
      kind: (overrides.kind ?? 'one_shot') as never,
      amount: overrides.amount ?? '100000000',
      netAmount: overrides.netAmount ?? '98500000',
      feeAmount: overrides.feeAmount ?? '1500000',
      currency: 'USDC',
      payerAddress: '0x' + 'b'.repeat(40),
      merchantAddress: '0x' + 'd'.repeat(40),
      onchainTxHash: '0x' + Math.random().toString(16).slice(2).padEnd(64, '0').slice(0, 64),
      blockNumber: 1000n,
      blockTimestamp: overrides.blockTimestamp ?? new Date(),
      logIndex: 0,
      status: (overrides.status ?? 'confirmed') as never,
      mode: 'live',
      customerId: overrides.customerId ?? null,
    },
  })
}

export async function seedAgentJob(
  prisma: PrismaClient,
  merchantId: string,
  overrides: Partial<{
    vendorAddress: string
    amount: string
    status:
      | 'proposed'
      | 'accepted'
      | 'in_progress'
      | 'delivered'
      | 'approved'
      | 'completed'
      | 'disputed'
      | 'cancelled'
    createdAt: Date
  }> = {},
): Promise<any> {
  return prisma.agentJob.create({
    data: {
      merchantId,
      vendorAddress: overrides.vendorAddress ?? '0x' + 'a'.repeat(40),
      assessorAddress: '0x' + 'b'.repeat(40),
      description: 'spec',
      amount: overrides.amount ?? '50000000',
      currency: 'USDC',
      status: (overrides.status ?? 'completed') as never,
      createdAt: overrides.createdAt ?? new Date(),
    },
  })
}
