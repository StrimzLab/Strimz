/**
 * Dashboard notifications. Derived server-side from recent activity
 * (confirmed payment sessions, new subscribers, processed refunds).
 * Read state is tracked on the merchant record via
 * `notificationsLastReadAt` — `event.createdAt <= that timestamp` is
 * "read", anything newer is "unread". No dedicated notifications
 * table because the source rows already exist; a separate table would
 * just be a denormalised copy.
 */

import { z } from 'zod'
import { idSchema, isoTimestampSchema } from './common.js'

export const notificationKindSchema = z.enum([
  'payment_received',
  'subscription_started',
  'refund_processed',
  /** Message an admin broadcast to this merchant (or all merchants). */
  'admin_broadcast',
])
export type NotificationKind = z.infer<typeof notificationKindSchema>

// ---------- Admin broadcasts ----------

export const broadcastAudienceSchema = z.enum(['all', 'merchant'])
export type BroadcastAudience = z.infer<typeof broadcastAudienceSchema>

export const createBroadcastInputSchema = z
  .object({
    title: z.string().min(4).max(160),
    body: z.string().min(4).max(4000),
    audience: broadcastAudienceSchema.default('all'),
    /** Required when `audience === 'merchant'`; ignored otherwise. */
    merchantId: z.string().optional(),
  })
  .refine((v) => v.audience !== 'merchant' || !!v.merchantId, {
    message: 'merchantId is required when audience is merchant',
    path: ['merchantId'],
  })
export type CreateBroadcastInput = z.infer<typeof createBroadcastInputSchema>

export const broadcastSchema = z.object({
  id: idSchema,
  title: z.string(),
  body: z.string(),
  audience: broadcastAudienceSchema,
  merchantId: idSchema.nullable(),
  merchantEmail: z.string().nullable(),
  senderId: idSchema,
  senderEmail: z.string(),
  emailedAt: isoTimestampSchema.nullable(),
  createdAt: isoTimestampSchema,
})
export type Broadcast = z.infer<typeof broadcastSchema>

export const broadcastListResponseSchema = z.object({
  data: z.array(broadcastSchema),
})
export type BroadcastListResponse = z.infer<typeof broadcastListResponseSchema>

export const notificationSchema = z.object({
  /** Deterministic client id — `{kind}:{sourceId}`. Safe for React keys. */
  id: z.string().min(1),
  kind: notificationKindSchema,
  title: z.string().min(1),
  detail: z.string(),
  /** Dashboard route the tray links to. */
  href: z.string().min(1),
  /** ISO timestamp of the source event; drives sort + read comparison. */
  createdAt: isoTimestampSchema,
  /** Server-derived from the merchant's `notificationsLastReadAt`. */
  read: z.boolean(),
  /** Optional foreign key back to the source row (for deep-linking). */
  sourceId: idSchema.optional(),
})
export type NotificationView = z.infer<typeof notificationSchema>

export const notificationListResponseSchema = z.object({
  data: z.array(notificationSchema),
  unreadCount: z.number().int().min(0),
  lastReadAt: isoTimestampSchema.nullable(),
})
export type NotificationListResponse = z.infer<typeof notificationListResponseSchema>

export const markNotificationsReadResponseSchema = z.object({
  lastReadAt: isoTimestampSchema,
})
export type MarkNotificationsReadResponse = z.infer<typeof markNotificationsReadResponseSchema>
