import type { SubscriptionResultErrorCode } from '@strimz/shared-types'

export class StrimzSubscriptionError extends Error {
  constructor(
    readonly code: SubscriptionResultErrorCode,
    readonly planId: string,
    message: string,
  ) {
    super(message)
    this.name = 'StrimzSubscriptionError'
  }
}
