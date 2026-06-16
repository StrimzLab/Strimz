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
    defaultCurrency: m.defaultCurrency,
    countryCode: m.countryCode,
    websiteUrl: m.websiteUrl,
    logoUrl: m.logoUrl,
    whitelabelEnabled: m.whitelabelEnabled,
    onboardingCompleted: Boolean(m.onboardingCompleted),
    twoFactorEnabled: Boolean(m.twoFactorEnabled),
    supportedChains: (m.supportedChains ?? []) as string[],
    payoutAddresses: (m.payoutAddresses ?? {}) as Record<string, string>,
    metadata: (m.metadata ?? {}) as Record<string, never>,
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
    updatedAt: m.updatedAt instanceof Date ? m.updatedAt.toISOString() : m.updatedAt,
  } as Merchant
}
