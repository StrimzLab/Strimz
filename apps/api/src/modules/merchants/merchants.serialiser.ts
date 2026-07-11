import type { Merchant } from '@strimz/shared-types'

/* eslint-disable @typescript-eslint/no-explicit-any */
export function serialiseMerchant(m: any): Merchant {
  return {
    id: m.id,
    onchainMerchantId: m.onchainMerchantId,
    businessName: m.businessName ?? '',
    email: m.email,
    tier: m.tier,
    status: m.status,
    payoutAddress: m.payoutAddress,
    walletAddress: m.walletAddress,
    onboardingCompleted: Boolean(m.onboardingCompleted),
    defaultCurrency: m.defaultCurrency,
    countryCode: m.countryCode,
    websiteUrl: m.websiteUrl,
    logoUrl: m.logoUrl,
    whitelabelEnabled: m.whitelabelEnabled,
    metadata: (m.metadata ?? {}) as Record<string, never>,
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
    updatedAt: m.updatedAt instanceof Date ? m.updatedAt.toISOString() : m.updatedAt,
  } as Merchant
}
