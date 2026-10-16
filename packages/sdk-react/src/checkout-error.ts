import type { CheckoutResultErrorCode } from '@strimz/shared-types'

export class StrimzCheckoutError extends Error {
  constructor(
    readonly code: CheckoutResultErrorCode,
    readonly sessionId: string,
    message: string,
  ) {
    super(message)
    this.name = 'StrimzCheckoutError'
  }
}
