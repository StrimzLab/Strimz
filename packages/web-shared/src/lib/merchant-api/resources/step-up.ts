import type { MerchantApiClient } from '../client'
import type { CallOptions } from '../types'

export type StepUpAction =
  | 'api_keys.create'
  | 'api_keys.rotate'
  | 'webhook_endpoints.create'
  | 'webhook_endpoints.rotate_secret'

export class StepUpResource {
  constructor(private readonly client: MerchantApiClient) {}

  /** POST /v1/auth/step-up/start. Privy's passkey challenge for this merchant. */
  start(action: StepUpAction, options?: CallOptions): Promise<{ options: unknown }> {
    return this.client.post('/v1/auth/step-up/start', { action }, options)
  }

  /** POST /v1/auth/step-up/verify. Returns the one-use token for `action`. */
  verify(
    action: StepUpAction,
    credential: unknown,
    options?: CallOptions,
  ): Promise<{ stepUpToken: string; expiresAt: string }> {
    return this.client.post('/v1/auth/step-up/verify', { action, credential }, options)
  }
}
