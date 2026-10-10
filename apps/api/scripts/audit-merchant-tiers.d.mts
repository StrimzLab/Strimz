import type { MerchantTier } from '@strimz/shared-config'

export interface AuditMerchant {
  id: string
  email: string
  tier: MerchantTier
  onchainMerchantId: number | null
}

export interface AuditTierChange {
  targetId: string
  actorId: string | null
  createdAt: Date | string
  metadata: unknown
}

export interface RegistryFeeRecord {
  feeBps: number
  maxFeeBps: number
}

export interface NonFreeTierRow {
  merchantId: string
  email: string
  tier: MerchantTier
  onchainMerchantId: string | null
  lastAdminTierChange: {
    actorId: string | null
    at: string
    previous: string | null
    next: string | null
  } | null
  explainedByAdmin: boolean
  suggestion: 'none' | 'reset_to_free' | 'decide_from_onchain_fee'
}

export interface RegisteredMerchantRow {
  merchantId: string
  onchainMerchantId: string
  tier: MerchantTier
  tierFeeBps: number | null
  onchainFeeBps: number
  maxFeeBps: number
  tiersAcceptedByAdminRoute: MerchantTier[]
  flags: Array<'fee_mismatch' | 'fee_below_tier' | 'ceiling_below_default'>
}

export interface MerchantTierAudit {
  nonFreeTiers: NonFreeTierRow[]
  registered: RegisteredMerchantRow[]
  flaggedCount: number
}

export function auditMerchantTiers(input: {
  merchants: AuditMerchant[]
  tierChanges: AuditTierChange[]
  registry: Map<string, RegistryFeeRecord>
}): MerchantTierAudit
