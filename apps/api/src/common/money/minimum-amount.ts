import { BadRequestException } from '@nestjs/common'
import { MINIMUM_PAYMENT_AMOUNT } from '@strimz/shared-config'

export const MINIMUM_AMOUNT = MINIMUM_PAYMENT_AMOUNT

export function assertMinimumAmount(amount: bigint | string): void {
  if (BigInt(amount) >= MINIMUM_AMOUNT) return
  throw new BadRequestException({
    code: 'amount_below_minimum',
    message: `amount must be at least ${MINIMUM_AMOUNT} base units (1.00)`,
    details: { minimum: MINIMUM_AMOUNT.toString() },
  })
}
