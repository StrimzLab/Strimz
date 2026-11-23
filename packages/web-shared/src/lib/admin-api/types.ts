/**
 * Wire shapes returned by `/v1/admin/*`. None of these live in
 * `@strimz/shared-types` because the admin surface is platform-internal
 *. Its consumers are only `apps/web` (the admin dashboard) and any
 * future operator tooling. Keeping them here avoids polluting the
 * external SDK with internal types.
 */

import type { CurrencyAmounts, Merchant, Mode, PaymentCurrency } from '@strimz/shared-types'

export type AdminRole = 'super_admin' | 'admin' | 'read_only'
export type AdminUserStatus = 'active' | 'suspended'
export type MerchantTier = 'free' | 'starter' | 'growth' | 'enterprise'
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
  invitePending: boolean
  inviteExpiresAt: string | null
}

export interface AdminInviteResult extends AdminProfile {
  /** Only outside production, so invites can be accepted without email. */
  acceptUrl?: string
}

export interface PlatformOverview {
  mode: Mode
  merchants: {
    total: number
    byStatus: Record<string, number>
    last30dSignups: number
  }
  volume: {
    /** 6-decimal raw integer string. USDC. */
    lifetime: CurrencyAmounts
    lifetimeFees: CurrencyAmounts
    last30d: CurrencyAmounts
    confirmedSessions: number
  }
  subscriptions: {
    active: number
    /** 6-decimal raw integer string. USDC. */
    mrr: CurrencyAmounts
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
  /** When a free merchant got its full relay quota; null while it is on the starter quota. */
  relayUnlockedAt: string | null
  lastLoginAt: string | null
  stats: {
    mode: Mode
    confirmedPayments: number
    activeSubscriptions: number
    /** 6-decimal raw integer string. */
    lifetimeVolume: CurrencyAmounts
    /** 6-decimal raw integer string. */
    last30dVolume: CurrencyAmounts
  }
}

export interface VolumePoint {
  /** ISO date `YYYY-MM-DD` */
  day: string
  currency: PaymentCurrency
  /** 6-decimal raw integer string. */
  volume: string
  /** 6-decimal raw integer string. */
  fees: string
  count: number
}

export interface VolumeSeriesResponse {
  mode: Mode
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
  volume: string
  transactionCount: number
}

export interface TopMerchantsResponse {
  mode: Mode
  currency: PaymentCurrency
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
  tier: 'enterprise'
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

// ---- Broadcasts ----

export type BroadcastAudience = 'all' | 'merchant'

export interface Broadcast {
  id: string
  title: string
  body: string
  audience: BroadcastAudience
  merchantId: string | null
  merchantEmail: string | null
  senderId: string
  senderEmail: string
  emailedAt: string | null
  createdAt: string
}

export interface BroadcastListResponse {
  data: Broadcast[]
}

export type AuditCategory =
  | 'merchant'
  | 'api_key'
  | 'webhook'
  | 'payment'
  | 'subscription'
  | 'refund'
  | 'agent'
  | 'compliance'
  | 'auth'
  | 'member'
  | 'settings'
  | 'admin'

export interface AuditLogEntry {
  id: string
  category: AuditCategory
  action: string
  targetType: string
  targetId: string
  merchantId: string | null
  actorEmail: string | null
  ipAddress: string | null
  metadata: Record<string, unknown>
  createdAt: string
  /** Written by the indexer from a chain event. */
  onchain: boolean
  /** Present for alerting rows; `alertedAt` is null until the email goes out. */
  alert: { alertedAt: string | null } | null
}

export interface AuditLogResponse {
  data: AuditLogEntry[]
  nextCursor: string | null
  hasMore: boolean
}

// ----- Safe console (ADR-2026-11-23-safe-console) -----

export type SafeContract =
  | 'registry'
  | 'payments'
  | 'subscriptions'
  | 'feeCollector'
  | 'tokenWhitelist'
export type SafeRole =
  | 'ADMIN_ROLE'
  | 'UPGRADER_ROLE'
  | 'PAUSER_ROLE'
  | 'TREASURY_ROLE'
  | 'TOKEN_MANAGER_ROLE'
  | 'FEE_ACCRUER_ROLE'
  | 'MERCHANT_REGISTRAR_ROLE'
  | 'FEE_MANAGER_ROLE'
  | 'CHARGER_ROLE'
  | 'SUBSCRIPTION_CANCELLER_ROLE'

export type SafeAction =
  | { kind: 'pause' | 'unpause'; contract: 'payments' | 'subscriptions' }
  | { kind: 'withdrawFees'; token: 'USDC' | 'EURC'; to: string; amount: string }
  | { kind: 'grantRole' | 'revokeRole'; contract: SafeContract; role: SafeRole; account: string }
  | { kind: 'timelockCancel'; operationId: string }
  | { kind: 'addOwner' | 'removeOwner'; owner: string; threshold: number }
  | { kind: 'swapOwner'; oldOwner: string; newOwner: string }
  | { kind: 'changeThreshold'; threshold: number }

export interface SafeState {
  chainId: number
  safe: `0x${string}`
  timelock: `0x${string}`
  guardian: `0x${string}`
  contracts: Record<SafeContract, `0x${string}`>
  owners: `0x${string}`[]
  threshold: number
  nonce: number
  timelockDelaySeconds: number
  paused: { payments: boolean; subscriptions: boolean }
}

export type SafeProposalStatus =
  | 'collecting'
  | 'ready'
  | 'executing'
  | 'executed'
  | 'failed'
  | 'stale'

export interface SafeProposal {
  id: string
  action: SafeAction | { kind: 'timelockExecute'; operationId: string }
  to: `0x${string}`
  data: `0x${string}`
  nonce: number
  safeTxHash: `0x${string}`
  status: SafeProposalStatus
  timelockOperationId: `0x${string}` | null
  scheduledById: string | null
  proposedById: string
  executedById: string | null
  executeTxHash: `0x${string}` | null
  failureReason: string | null
  executedAt: string | null
  createdAt: string
  signatures: { signer: `0x${string}`; signature: `0x${string}`; createdAt: string }[]
}
