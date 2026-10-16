import { StrimzApiError } from '@/lib/merchant-api/errors'

const TIER_REFUSAL_CODES = new Set(['merchant_not_registered'])

export interface TierRefusal {
  message: string
}

export function tierRefusal(error: unknown): TierRefusal | null {
  if (!(error instanceof StrimzApiError) || !TIER_REFUSAL_CODES.has(error.code)) return null
  return { message: error.message }
}
