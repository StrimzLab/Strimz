/** Charges an open-ended subscription approves at once. */
export const OPEN_ENDED_CHARGES = 12

/**
 * The token allowance a subscriber grants: 12 charges, or exactly the charges
 * left before the end date. Charges run at firstChargeAt + k × interval while
 * before endAt, so a trial (a later firstChargeAt) adds nothing.
 */
export function allowanceCap(input: {
  amount: bigint
  interval: number
  firstChargeAt: bigint
  endAt: bigint
}): { value: bigint; charges: number } {
  let charges = OPEN_ENDED_CHARGES
  if (input.endAt > 0n) {
    const span = input.endAt - input.firstChargeAt
    charges = span <= 0n ? 1 : Number((span - 1n) / BigInt(input.interval)) + 1
  }
  return { value: input.amount * BigInt(charges), charges }
}

export const UINT256_MAX = (1n << 256n) - 1n

/**
 * EIP-2612 permit replaces the allowance, and every subscription a payer has in
 * a token shares one spender, so sign what's already approved plus the new cap.
 */
export function topUpAllowance(current: bigint, cap: bigint): bigint {
  return current >= UINT256_MAX - cap ? UINT256_MAX : current + cap
}
