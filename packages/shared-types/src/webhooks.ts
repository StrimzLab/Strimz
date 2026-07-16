/**
 * Webhook endpoints and deliveries.
 *
 * Endpoint = the URL the merchant registered.
 * Event    = the thing that happened.
 * Delivery = one attempt to POST a specific event to a specific endpoint.
 */

import { z } from 'zod'
import { httpsUrlSchema, idSchema, isoTimestampSchema, modeSchema } from './common.js'

// ---------- Event name ----------

/**
 * Every webhook event name in the system. Listed inline so Zod can
 * produce a concrete string union.
 */
export const webhookEventNameSchema = z.enum([
  'payment.created',
  'payment.completed',
  'payment.failed',
  'subscription.created',
  'subscription.charged',
  'subscription.charge_failed',
  'subscription.recovery_attempt',
  'subscription.recovery_outcome',
  'subscription.cancelled',
  'subscription.lapsed',
  'refund.created',
  'refund.completed',
  'refund.failed',
  'invoice.created',
  'invoice.paid',
  'invoice.overdue',
  'agent.action_executed',
  'agent.job_proposed',
  'agent.job_completed',
  'agent.job_disputed',
  'compliance.wallet_flagged',
  'compliance.wallet_blocked',
])
export type WebhookEventName = z.infer<typeof webhookEventNameSchema>

// ---------- Endpoints ----------

export const webhookEndpointStatusSchema = z.enum(['active', 'disabled'])
export type WebhookEndpointStatus = z.infer<typeof webhookEndpointStatusSchema>

export const webhookEndpointSchema = z.object({
  id: idSchema,
  merchantId: idSchema,
  mode: modeSchema,
  url: httpsUrlSchema,
  description: z.string().max(200).nullable(),
  events: z.array(webhookEventNameSchema).nonempty(),
  status: webhookEndpointStatusSchema,
  signingSecretPrefix: z.string().min(4).max(12),
  lastDeliveredAt: isoTimestampSchema.nullable(),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})
export type WebhookEndpoint = z.infer<typeof webhookEndpointSchema>

export const createWebhookEndpointInputSchema = z.object({
  url: httpsUrlSchema,
  events: z.array(webhookEventNameSchema).nonempty(),
  description: z.string().max(200).optional(),
  mode: modeSchema,
})
export type CreateWebhookEndpointInput = z.infer<typeof createWebhookEndpointInputSchema>

export const createWebhookEndpointOutputSchema = z.object({
  endpoint: webhookEndpointSchema,
  /** Full signing secret. Shown exactly once. */
  signingSecret: z.string(),
})
export type CreateWebhookEndpointOutput = z.infer<typeof createWebhookEndpointOutputSchema>

// ---------- Deliveries ----------

export const webhookDeliveryStatusSchema = z.enum([
  'pending',
  'delivered',
  'retrying',
  'permanently_failed',
])
export type WebhookDeliveryStatus = z.infer<typeof webhookDeliveryStatusSchema>

export const webhookDeliverySchema = z.object({
  id: idSchema,
  merchantId: idSchema,
  endpointId: idSchema,
  eventId: idSchema,
  eventName: webhookEventNameSchema,
  status: webhookDeliveryStatusSchema,
  attempt: z.number().int().min(1).max(6),
  responseCode: z.number().int().min(100).max(599).nullable(),
  responseMs: z.number().int().min(0).nullable(),
  lastError: z.string().max(1000).nullable(),
  nextAttemptAt: isoTimestampSchema.nullable(),
  deliveredAt: isoTimestampSchema.nullable(),
  createdAt: isoTimestampSchema,
})
export type WebhookDelivery = z.infer<typeof webhookDeliverySchema>

/**
 * Detail projection returned by GET /v1/webhook-deliveries/:id.
 * Carries the payload envelope, response body, and the deliveryId
 * header the receiver saw. Kept separate so list responses stay slim.
 */
export const webhookDeliveryDetailSchema = webhookDeliverySchema.extend({
  deliveryId: z.string(),
  responseBody: z.string().nullable(),
  requestPayload: z.record(z.string(), z.unknown()),
})
export type WebhookDeliveryDetail = z.infer<typeof webhookDeliveryDetailSchema>

export const replayDeliveryInputSchema = z.object({
  id: idSchema,
})
export type ReplayDeliveryInput = z.infer<typeof replayDeliveryInputSchema>
