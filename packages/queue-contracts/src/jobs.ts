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

// ----- Relay submission -----

const hexMatching = (pattern: RegExp, label: string) =>
  z.custom<`0x${string}`>((v) => typeof v === 'string' && pattern.test(v), { message: label })

const txHashSchema = hexMatching(/^0x[0-9a-fA-F]{64}$/, 'expected a 32-byte hex hash')
const addressSchema = hexMatching(/^0x[0-9a-fA-F]{40}$/, 'expected a 20-byte hex address')
const calldataSchema = hexMatching(/^0x([0-9a-fA-F]{2})*$/, 'expected hex calldata')

export const relayBroadcastSchema = z.object({
  txHash: txHashSchema,
  nonce: z.string().regex(/^\d+$/),
})
export type RelayBroadcast = z.infer<typeof relayBroadcastSchema>

const relayCallFields = {
  idempotencyKey: z.string().min(1),
  toAddress: addressSchema,
  callData: calldataSchema,
  gasLimit: z.string().regex(/^\d+$/),
  merchantInternalId: z.string().optional(),
  sessionId: z.string().optional(),
  subscriptionInternalId: z.string().optional(),
  broadcast: relayBroadcastSchema.optional(),
}

export const relayJobSchema = z.discriminatedUnion('reason', [
  z.object({ reason: z.literal('payWithAuthorization'), ...relayCallFields }),
  z.object({ reason: z.literal('permitAndCreateSubscription'), ...relayCallFields }),
  z.object({
    reason: z.literal('registerMerchant'),
    idempotencyKey: z.string().min(1),
    merchantInternalId: z.string().min(1),
    broadcast: relayBroadcastSchema.optional(),
  }),
])
export type RelayJob = z.infer<typeof relayJobSchema>
export type RelayReason = RelayJob['reason']
