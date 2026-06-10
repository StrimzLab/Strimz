/**
 * Wire shapes returned by `/v1/admin/*`. None of these live in
 * `@strimz/shared-types` because the admin surface is platform-internal
 * — its consumers are only `apps/web` (the admin dashboard) and any
 * future operator tooling. Keeping them here avoids polluting the
 * external SDK with internal types.
 */

import type { Merchant } from '@strimz/shared-types'

export type AdminRole = 'super_admin' | 'admin' | 'read_only'
export type AdminUserStatus = 'active' | 'suspended'
export type MerchantTier = 'free' | 'growth' | 'business' | 'enterprise'
export type MerchantStatus = 'active' | 'suspended' | 'closed'

export interface AdminProfile {
  id: string
  email: string
  name: string | null
  role: AdminRole
  status: AdminUserStatus
  lastLoginAt: string | null
  createdAt: string
}

export interface AdminListItem extends AdminProfile {
  invitedAt: string
  invitedBy: { id: string; email: string } | null
}

export interface PlatformOverview {
  merchants: {
    total: number
    byStatus: Record<string, number>
    last30dSignups: number
  }
  volume: {
    /** 6-decimal raw integer string. USDC. */
    lifetimeUsdc: string
    lifetimeFeesUsdc: string
    last30dUsdc: string
    confirmedSessions: number
  }
  subscriptions: {
    active: number
    /** 6-decimal raw integer string. USDC. */
    mrrUsdc: string
  }
}

export interface AdminMerchantListItem {
  id: string
  email: string
  businessName: string | null
  tier: MerchantTier
  status: MerchantStatus
  defaultCurrency: 'USDC' | 'EURC'
  countryCode: string | null
  createdAt: string
  lastLoginAt: string | null
}

export interface AdminMerchantListResponse {
  data: AdminMerchantListItem[]
  nextCursor: string | null
  hasMore: boolean
}

/** Merchant detail with adjacent counts. */
export interface AdminMerchantDetail extends Pick<
  Merchant,
  | 'id'
  | 'email'
  | 'businessName'
  | 'tier'
  | 'status'
  | 'payoutAddress'
  | 'defaultCurrency'
  | 'countryCode'
  | 'websiteUrl'
  | 'logoUrl'
  | 'createdAt'
> {
  onchainMerchantId: number | null
  lastLoginAt: string | null
  stats: {
    confirmedPayments: number
    activeSubscriptions: number
    /** 6-decimal raw integer string. */
    lifetimeVolumeUsdc: string
    /** 6-decimal raw integer string. */
    last30dVolumeUsdc: string
  }
}

export interface VolumePoint {
  /** ISO date `YYYY-MM-DD` */
  day: string
  /** 6-decimal raw integer string. */
  volume: string
  /** 6-decimal raw integer string. */
  fees: string
  count: number
}

export interface VolumeSeriesResponse {
  from: string
  to: string
  data: VolumePoint[]
}

export interface SignupPoint {
  day: string
  count: number
}

export interface SignupSeriesResponse {
  from: string
  to: string
  data: SignupPoint[]
}

export interface TopMerchant {
  merchantId: string
  businessName: string | null
  email: string
  /** 6-decimal raw integer string. */
  volumeUsdc: string
  transactionCount: number
}

export interface TopMerchantsResponse {
  data: TopMerchant[]
}

export interface IndexerCursor {
  contractAddress: string
  environment: 'testnet' | 'mainnet'
  lastProcessedBlock: string
  updatedAt: string
}

export interface HealthResponse {
  indexerCursors: IndexerCursor[]
  webhookDelivery1h: Record<string, number>
  subscriptions: {
    atRisk: number
    lapsedLast7d: number
  }
}

// ---- Mutation inputs ----

export interface SetMerchantStatusInput {
  status: MerchantStatus
}

export interface SetMerchantTierInput {
  tier: MerchantTier
}

export interface InviteAdminInput {
  email: string
  name?: string
  role: AdminRole
}

export interface SetAdminRoleInput {
  role: AdminRole
}

export interface SetAdminStatusInput {
  status: AdminUserStatus
}
