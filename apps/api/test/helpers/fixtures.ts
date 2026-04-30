import { generateApiKey } from '@strimz/shared-crypto'
import type { PrismaClient } from '@strimz/db'
import { makePrivyDid } from './stubs/privy.stub.js'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface SeededMerchant {
  id: string
  email: string
  privyUserId: string
  /** A Privy access token shaped for the stub. */
  privyAccessToken: string
}

export async function seedMerchant(
  prisma: PrismaClient,
  overrides: Partial<{
    email: string
    businessName: string
    onboardingCompleted: boolean
    emailVerified: boolean
    twoFactorEnabled: boolean
    payoutAddress: string
    mfa: boolean
  }> = {},
): Promise<SeededMerchant> {
  const email =
    overrides.email ?? `merchant-${Date.now()}-${Math.random().toString(36).slice(2)}@strimz.test`
  const privyUserId = makePrivyDid(email, overrides.mfa ?? false)
  const m = await prisma.merchant.create({
    data: {
      privyUserId,
      email,
      emailVerified: overrides.emailVerified ?? true,
      twoFactorEnabled: overrides.twoFactorEnabled ?? false,
      onboardingCompleted: overrides.onboardingCompleted ?? false,
      businessName: overrides.businessName ?? 'Acme Co',
      payoutAddress: overrides.payoutAddress ?? '0x000000000000000000000000000000000000beef',
    },
  })
  return {
    id: m.id,
    email,
    privyUserId,
    privyAccessToken: `test|${privyUserId}|${email}|${overrides.mfa ? 'mfa' : ''}`,
  }
}

export interface SeededApiKey {
  id: string
  secretKey: string
}

export async function seedApiKey(
  prisma: PrismaClient,
  merchantId: string,
  overrides: { mode?: 'test' | 'live'; scopes?: string[]; revoked?: boolean; kind?: 'secret' | 'publishable' } = {},
): Promise<SeededApiKey> {
  const mode = overrides.mode ?? 'test'
  const kind = overrides.kind ?? 'secret'
  const generated = await generateApiKey(kind, mode)
  const k = await prisma.merchantApiKey.create({
    data: {
      merchantId,
      name: 'e2e',
      hash: generated.hash,
      prefix: generated.prefix,
      lastFour: generated.lastFour,
      kind,
      mode,
      scopes: (overrides.scopes ?? [
        'sessions_read',
        'sessions_write',
        'subscriptions_read',
        'subscriptions_write',
        'refunds_read',
        'refunds_write',
        'webhooks_read',
        'webhooks_write',
        'invoices_read',
        'invoices_write',
        'agents_read',
        'agents_write',
      ]) as any,
      revokedAt: overrides.revoked ? new Date() : null,
    },
  })
  return { id: k.id, secretKey: generated.secret }
}

export async function seedCustomer(
  prisma: PrismaClient,
  merchantId: string,
  overrides: Partial<{ email: string; walletAddress: string }> = {},
) {
  return prisma.customer.create({
    data: {
      merchantId,
      email: overrides.email ?? `customer-${Date.now()}@buyer.test`,
      walletAddress:
        overrides.walletAddress ??
        '0x' + Math.random().toString(16).slice(2).padEnd(40, '0').slice(0, 40),
    },
  })
}

export async function seedTransaction(
  prisma: PrismaClient,
  merchantId: string,
  overrides: Partial<{
    amount: string
    netAmount: string
    customerId: string
    payerAddress: string
    status: 'pending' | 'confirmed' | 'failed'
    mode: 'test' | 'live'
    blockTimestamp: Date
    merchantAddress: string
  }> = {},
) {
  return prisma.transaction.create({
    data: {
      merchantId,
      kind: 'one_shot',
      amount: overrides.amount ?? '100000000', // 100 USDC (6dp)
      netAmount: overrides.netAmount ?? '98500000',
      feeAmount: '1500000',
      currency: 'USDC',
      payerAddress: overrides.payerAddress ?? '0x' + 'b'.repeat(40),
      merchantAddress:
        overrides.merchantAddress ?? '0x000000000000000000000000000000000000beef',
      onchainTxHash:
        '0x' + Math.random().toString(16).slice(2).padEnd(64, '0').slice(0, 64),
      blockNumber: 1000n,
      blockTimestamp: overrides.blockTimestamp ?? new Date(),
      logIndex: 0,
      status: overrides.status ?? 'confirmed',
      mode: overrides.mode ?? 'test',
      customerId: overrides.customerId ?? null,
    },
  })
}

export async function seedSubscription(
  prisma: PrismaClient,
  merchantId: string,
  overrides: Partial<{
    planId: string
    customerId: string
    payerAddress: string
    status: 'active' | 'paused' | 'cancelled' | 'lapsed' | 'completed'
    interval: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
    intervalCount: number
    amount: string
    mode: 'test' | 'live'
  }> = {},
) {
  // Plan is required, so seed one if not provided.
  let planId = overrides.planId
  if (!planId) {
    const plan = await prisma.subscriptionPlan.create({
      data: {
        merchantId,
        name: 'Test Plan',
        amount: overrides.amount ?? '20000000',
        currency: 'USDC',
        interval: overrides.interval ?? 'monthly',
        intervalCount: overrides.intervalCount ?? 1,
      },
    })
    planId = plan.id
  }

  let customerId = overrides.customerId
  if (!customerId) {
    const c = await seedCustomer(prisma, merchantId)
    customerId = c.id
  }

  const now = new Date()
  return prisma.subscription.create({
    data: {
      merchantId,
      planId,
      customerId,
      payerAddress: overrides.payerAddress ?? '0x' + 'c'.repeat(40),
      currency: 'USDC',
      amount: overrides.amount ?? '20000000',
      interval: overrides.interval ?? 'monthly',
      intervalCount: overrides.intervalCount ?? 1,
      gracePeriodHours: 48,
      status: overrides.status ?? 'active',
      mode: overrides.mode ?? 'test',
      currentPeriodStartAt: now,
      currentPeriodEndAt: new Date(now.getTime() + 30 * 86_400_000),
      nextChargeAt: new Date(now.getTime() + 30 * 86_400_000),
    },
  })
}
