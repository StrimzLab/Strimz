import { z } from 'zod'

/**
 * Every queue job payload is Zod-validated at the worker boundary. A
 * malformed job throws cleanly via BullMQ's failure path instead of
 * corrupting state mid-execution.
 */

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
])
export type AgentActionJob = z.infer<typeof agentActionJobSchema>
