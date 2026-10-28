// Matches StrimzRegistry.MAX_FEE_BPS.
const MAX_FEE_BPS = 500

/** The contracts' fee rule: rounded down, so Strimz never takes more than the rate. */
export function feeSplit(amount: bigint, feeBps: number): { feeAmount: bigint; netAmount: bigint } {
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > MAX_FEE_BPS) {
    throw new Error(`fee rate out of range: ${feeBps} bps`)
  }
  const feeAmount = (amount * BigInt(feeBps)) / 10_000n
  return { feeAmount, netAmount: amount - feeAmount }
}
