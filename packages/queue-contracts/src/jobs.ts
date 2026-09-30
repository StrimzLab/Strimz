import { z } from 'zod'

// ----- Webhook delivery -----

export const webhookDeliveryJobSchema = z.object({
  deliveryId: z.string(),
  endpointId: z.string(),
  url: z.string().url(),
  signingSecretHash: z.string().regex(/^[0-9a-f]{64}$/, 'sha256 hex'),
  eventId: z.string(),
  /** True only on manual replay via the API's /replay endpoint. */
  replay: z.boolean().optional(),
})
export type WebhookDeliveryJob = z.infer<typeof webhookDeliveryJobSchema>

// ----- Subscription due -----

export const subscriptionDueJobSchema = z.object({
  /** Off-chain Subscription.id — looked up to read its onchainSubscriptionId. */
  subscriptionId: z.string(),
})
export type SubscriptionDueJob = z.infer<typeof subscriptionDueJobSchema>

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

// ----- Agent action -----

export const agentActionJobSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('subscription.cancel-onchain'),
    subscriptionId: z.string(),
    onchainSubscriptionId: z.number().int().nullable(),
    merchantId: z.string(),
    reason: z.string().nullable(),
  }),
  z.object({
    type: z.literal('job.create-onchain'),
    jobId: z.string(),
  }),
  z.object({
    type: z.literal('job.release-onchain'),
    jobId: z.string(),
  }),
  z.object({
    type: z.literal('job.dispute-onchain'),
    jobId: z.string(),
    reason: z.string(),
  }),
  z.object({
    type: z.literal('job.cancel-onchain'),
    jobId: z.string(),
    reason: z.string(),
  }),
  routingSettleActionSchema,
])
export type AgentActionJob = z.infer<typeof agentActionJobSchema>

// ----- CCTP bridge -----

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
  /** Poll count. Incremented on each re-enqueue; bounds the attestation wait. */
  pollCount: z.number().int().nonnegative().default(0),
})
export type CctpBridgeJob = z.infer<typeof cctpBridgeJobSchema>
