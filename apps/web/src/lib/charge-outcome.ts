import type { SubscriptionChargeOutcome, SubscriptionChargeStatus } from '@strimz/shared-types'

import type { StatusTone } from '@/components/dashboard/data-table'

export interface ChargeOutcomeView {
  label: string
  tone: StatusTone
}

const OUTCOMES: Record<SubscriptionChargeOutcome, ChargeOutcomeView> = {
  charged: { label: 'Charged', tone: 'positive' },
  insufficient_funds: { label: 'Failed: not enough balance', tone: 'danger' },
  revoked_approval: { label: 'Failed: approval revoked', tone: 'danger' },
  merchant_inactive: { label: 'Failed: merchant inactive', tone: 'danger' },
  transfer_failed: { label: 'Failed: transfer reverted', tone: 'danger' },
  // The token was delisted. Not the payer's fault, and the subscription stays active.
  token_not_allowed: { label: 'Skipped: token not accepted', tone: 'neutral' },
  not_due: { label: 'Skipped: not due yet', tone: 'neutral' },
  duplicate: { label: 'Skipped: already charged', tone: 'neutral' },
  ended: { label: 'Skipped: subscription ended', tone: 'neutral' },
  cancelled: { label: 'Skipped: subscription cancelled', tone: 'neutral' },
  unknown: { label: 'Skipped: subscription not found on chain', tone: 'neutral' },
  skipped: { label: 'Skipped', tone: 'neutral' },
}

const STATUSES: Record<SubscriptionChargeStatus, string> = {
  pending: 'Pending',
  in_flight: 'In flight',
  succeeded: 'Charged',
  failed: 'Failed',
  retrying: 'Retrying',
  abandoned: 'Abandoned',
}

export function chargeOutcomeView(
  outcome: SubscriptionChargeOutcome | null,
  status: SubscriptionChargeStatus,
): ChargeOutcomeView {
  if (outcome) return OUTCOMES[outcome]
  return { label: STATUSES[status], tone: 'info' }
}
