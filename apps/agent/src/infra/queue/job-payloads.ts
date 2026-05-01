import { z } from 'zod'

/** Zod schemas for jobs the agent enqueues or consumes. */

// ---------- Inbound (consumed by agent.routing.bridge worker) ----------

/**
 * `strimz.routing.cctp.bridge` payload — produced by the checkout
 * client (`apps/web`) when a payer commits to a cross-chain pay-with-USDC
 * flow. The agent's bridge worker takes it from there.
 */
export const cctpBridgeJobSchema = z.object({
  /** Off-chain Strimz merchant id receiving the payment. */
  merchantId: z.string(),
  /** CCTP domain id of the source chain (where the payer bridged from). */
  sourceDomainId: z.number().int().nonnegative(),
  /** Source-chain transaction hash containing the `MessageSent` event. */
  sourceTxHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  /**
   * Optional reference to whatever off-chain entity this bridge fulfills
   * (e.g. PaymentSession.id). Echoed back in the activity log so the
   * dashboard can link back.
   */
  ref: z.string().optional(),
})
export type CctpBridgeJob = z.infer<typeof cctpBridgeJobSchema>

// ---------- Outbound (enqueued by agent → consumed by scheduler) ----------

/**
 * The scheduler's `agent.action` queue has a discriminated union we
 * append to. We declare the relevant arm here so the agent can construct
 * a payload without importing scheduler internals.
 */
export const routingSettleActionSchema = z.object({
  type: z.literal('routing.cctp.settle'),
  merchantId: z.string(),
  sourceDomainId: z.number().int().nonnegative(),
  sourceTxHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  /** Hex-encoded raw message bytes returned by Circle's API. */
  messageHex: z.string().regex(/^0x[0-9a-fA-F]+$/),
  /** Hex-encoded attestation bytes returned by Circle's API. */
  attestationHex: z.string().regex(/^0x[0-9a-fA-F]+$/),
  ref: z.string().optional(),
})
export type RoutingSettleAction = z.infer<typeof routingSettleActionSchema>
