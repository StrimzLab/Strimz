import type {
  Merchant,
  MerchantBalanceView,
  OnboardMerchantInput,
  UpdateMerchantInput,
} from '@strimz/shared-types'

import type { MerchantApiClient } from '../client'
import type { CallOptions } from '../types'

/**
 * Singleton resource. Every merchant only has one "self" record, so
 * there is no `list`. `retrieve` resolves the merchant tied to the
 * caller's Privy token via the apps/api auth guard.
 */
export class MerchantResource {
  constructor(private readonly client: MerchantApiClient) {}

  /** GET /v1/merchants/me. The caller's own merchant record. */
  retrieve(options?: CallOptions): Promise<Merchant> {
    return this.client.get<Merchant>('/v1/merchants/me', options)
  }

  update(input: UpdateMerchantInput, options?: CallOptions): Promise<Merchant> {
    return this.client.patch<Merchant>('/v1/merchants/me', input, options)
  }

  /**
   * POST /v1/merchants/me/onboard. One-shot self-attested onboarding
   * form. On success the API flips `onboardingCompleted: true` so the
   * dashboard exits the wizard.
   */
  onboard(input: OnboardMerchantInput, options?: CallOptions): Promise<Merchant> {
    return this.client.post<Merchant>('/v1/merchants/me/onboard', input, options)
  }

  /**
   * GET /v1/merchants/me/balance. Live on-chain USDC / EURC balance
   * at the merchant's payout address. Powers the withdraw page.
   */
  balance(options?: CallOptions): Promise<MerchantBalanceView> {
    return this.client.get<MerchantBalanceView>('/v1/merchants/me/balance', options)
  }

  /**
   * GET /v1/merchants/me/onchain-state. Current on-chain merchant
   * record from the Registry, including any pending owner or pending
   * payout-address change. Returns null when the merchant has not
   * registered on-chain yet or the RPC read fails.
   */
  onchainState(options?: CallOptions): Promise<OnchainMerchantState | null> {
    return this.client.get<OnchainMerchantState | null>('/v1/merchants/me/onchain-state', options)
  }
}

export interface OnchainMerchantState {
  onchainMerchantId: number
  registryAddress: `0x${string}`
  chainId: number
  owner: `0x${string}`
  payoutAddress: `0x${string}`
  feeBps: number
  maxFeeBps: number
  active: boolean
  pendingOwner: `0x${string}` | null
  pendingPayoutAddress: `0x${string}` | null
  payoutChangeCommitAt: number | null
  payoutChangeDelaySeconds: number
}
