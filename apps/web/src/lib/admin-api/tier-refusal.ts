import { z } from 'zod'

import { StrimzApiError } from '@/lib/merchant-api/errors'

const TIER_REFUSAL_CODES = new Set([
  'merchant_not_registered',
  'onchain_fee_mismatch',
  'onchain_fee_above_ceiling',
])

const tierRefusalDetailsSchema = z.object({
  onchainMerchantId: z.string(),
  onchainFeeBps: z.number().int(),
  requiredFeeBps: z.number().int(),
  maxFeeBps: z.number().int(),
})

export interface TierRefusal {
  message: string
  facts: Array<[label: string, value: string]>
}

export function tierRefusal(error: unknown): TierRefusal | null {
  if (!(error instanceof StrimzApiError) || !TIER_REFUSAL_CODES.has(error.code)) return null
  const details = tierRefusalDetailsSchema.safeParse(error.details)
  if (!details.success) return { message: error.message, facts: [] }
  const { onchainMerchantId, onchainFeeBps, requiredFeeBps, maxFeeBps } = details.data
  return {
    message: error.message,
    facts: [
      ['On-chain merchant id', onchainMerchantId],
      ['Registry fee', `${onchainFeeBps} bps`],
      ['Tier needs', `${requiredFeeBps} bps`],
      ['On-chain ceiling', `${maxFeeBps} bps`],
    ],
  }
}
