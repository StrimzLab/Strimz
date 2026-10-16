import { BadRequestException } from '@nestjs/common'

export const MINIMUM_AMOUNT = 1_000_000n

export function assertMinimumAmount(amount: bigint | string): void {
  if (BigInt(amount) >= MINIMUM_AMOUNT) return
  throw new BadRequestException({
    code: 'amount_below_minimum',
    message: `amount must be at least ${MINIMUM_AMOUNT} base units (1.00)`,
    details: { minimum: MINIMUM_AMOUNT.toString() },
  })
}
