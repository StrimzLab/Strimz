import type { Merchant, OnboardMerchantInput, UpdateMerchantInput } from '@strimz/shared-types'

import type { MerchantApiClient } from '../client'
import type { CallOptions } from '../types'

/**
 * Singleton resource — every merchant only has one "self" record, so
 * there is no `list`. `retrieve` resolves the merchant tied to the
 * caller's Privy token via the apps/api auth guard.
 */
export class MerchantResource {
  constructor(private readonly client: MerchantApiClient) {}

  /** GET /v1/merchants/me — the caller's own merchant record. */
  retrieve(options?: CallOptions): Promise<Merchant> {
    return this.client.get<Merchant>('/v1/merchants/me', options)
  }

  update(input: UpdateMerchantInput, options?: CallOptions): Promise<Merchant> {
    return this.client.patch<Merchant>('/v1/merchants/me', input, options)
  }

  /**
   * POST /v1/merchants/me/onboard — submits the self-attested onboarding
   * form. Flips `onboardingCompleted` to true, which the sidebar
   * "Unlock live mode" banner and the live-key issuance gate read from.
   */
  onboard(input: OnboardMerchantInput, options?: CallOptions): Promise<Merchant> {
    return this.client.post<Merchant>('/v1/merchants/me/onboard', input, options)
  }
}
