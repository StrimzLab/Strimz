import { z } from 'zod'

export const outboxRefSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('payment.completed'),
    sessionId: z.string(),
    transactionId: z.string(),
  }),
  z.object({
    kind: z.literal('payment.failed'),
    sessionId: z.string(),
    reason: z.string().optional(),
  }),
  z.object({ kind: z.literal('invoice.paid'), invoiceId: z.string(), transactionId: z.string() }),
  z.object({ kind: z.literal('invoice.overdue'), invoiceId: z.string() }),
  z.object({ kind: z.literal('subscription.created'), subscriptionId: z.string() }),
  z.object({ kind: z.literal('subscription.lapsed'), subscriptionId: z.string() }),
  z.object({
    kind: z.literal('subscription.charged'),
    subscriptionId: z.string(),
    chargeId: z.string(),
    transactionId: z.string(),
  }),
  z.object({
    kind: z.literal('subscription.charge_failed'),
    subscriptionId: z.string(),
    chargeId: z.string(),
  }),
  z.object({ kind: z.literal('refund.completed'), refundId: z.string() }),
])

export type OutboxRef = z.infer<typeof outboxRefSchema>

export function readOutboxRef(payload: unknown): unknown {
  if (typeof payload !== 'object' || payload === null) return undefined
  return (payload as { ref?: unknown }).ref ?? undefined
}
