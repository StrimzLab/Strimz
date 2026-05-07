import type { PrismaClient } from '@strimz/db'
import { generateApiKey, randomBase64Url, sha256Hex } from '@strimz/shared-crypto'

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function seedMerchant(
  prisma: PrismaClient,
  overrides: Partial<{
    id: string
    email: string
    payoutAddress: string
    onchainMerchantId: number | null
  }> = {},
): Promise<any> {
  const id = overrides.id ?? `m_${Math.random().toString(36).slice(2, 10)}`
  return prisma.merchant.create({
    data: {
      id,
      privyUserId: `did:privy:e2e:${id}`,
      email: overrides.email ?? `${id}@strimz.test`,
      payoutAddress: overrides.payoutAddress ?? '0x000000000000000000000000000000000000beef',
      onchainMerchantId: overrides.onchainMerchantId ?? null,
      emailVerified: true,
    },
  })
}

export async function seedWebhookEndpoint(
  prisma: PrismaClient,
  merchantId: string,
  opts: { url: string; events: string[]; mode?: 'test' | 'live' },
) {
  const secret = `whsec_${randomBase64Url(32)}`
  const signingSecretHash = await sha256Hex(secret)
  const ep = await prisma.merchantWebhookEndpoint.create({
    data: {
      merchantId,
      url: opts.url,
      events: opts.events as never,
      mode: opts.mode ?? 'test',
      status: 'active',
      signingSecretHash,
      signingSecretPrefix: secret.slice(0, 12),
    },
  })
  return { endpoint: ep, secret }
}

export async function seedWebhookEvent(
  prisma: PrismaClient,
  merchantId: string,
  type = 'subscription_cancelled',
  data: Record<string, unknown> = {},
): Promise<any> {
  const id = `evt_${Math.random().toString(36).slice(2, 12)}`
  return prisma.webhookEvent.create({
    data: {
      id,
      merchantId,
      type: type as never,
      apiVersion: '2026-04-27',
      mode: 'test',
      payload: { id, type: type.replace(/_/g, '.'), data } as never,
    },
  })
}

export async function seedDelivery(
  prisma: PrismaClient,
  merchantId: string,
  endpointId: string,
  eventId: string,
  eventName: string,
) {
  const id = `whdl_${Math.random().toString(36).slice(2, 12)}`
  return prisma.webhookDelivery.create({
    data: {
      id,
      deliveryId: id,
      merchantId,
      endpointId,
      eventId,
      eventName: eventName as never,
      status: 'pending',
      attempt: 0,
    },
  })
}

export async function seedSubscription(
  prisma: PrismaClient,
  merchantId: string,
  overrides: Partial<{
    onchainSubscriptionId: number | null
    nextChargeAt: Date | null
    status: 'active' | 'at_risk' | 'cancelled' | 'lapsed'
    chargeLock: boolean
    payerAddress: string
  }> = {},
): Promise<any> {
  const customer = await prisma.customer.create({
    data: {
      merchantId,
      walletAddress:
        overrides.payerAddress ??
        '0x' + Math.random().toString(16).slice(2).padEnd(40, '0').slice(0, 40),
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
      status: (overrides.status ?? 'active') as never,
      chargeLock: overrides.chargeLock ?? false,
      // `null` is meaningful (indexer hasn't projected yet); only fall through
      // when the caller didn't supply the field at all.
      onchainSubscriptionId:
        overrides.onchainSubscriptionId === undefined ? 1 : overrides.onchainSubscriptionId,
      payerAddress: customer.walletAddress,
      currency: 'USDC',
      amount: '20000000',
      interval: 'monthly',
      intervalCount: 1,
      currentPeriodStartAt: now,
      currentPeriodEndAt: new Date(now.getTime() + 30 * 86_400_000),
      nextChargeAt:
        overrides.nextChargeAt === undefined
          ? new Date(now.getTime() - 60_000)
          : overrides.nextChargeAt,
      mode: 'test',
    },
  })
}

export { generateApiKey }
