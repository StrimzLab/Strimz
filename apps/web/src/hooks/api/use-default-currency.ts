'use client'

import type { PaymentCurrency } from '@strimz/shared-types'

import { useMerchantMe } from './use-merchant'

/** The merchant's Settings → Default currency; USDC until the profile loads. */
export function useDefaultCurrency(): PaymentCurrency {
  return useMerchantMe().data?.defaultCurrency ?? 'USDC'
}
