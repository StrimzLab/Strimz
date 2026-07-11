/**
 * Public marketing contact form. Not an authenticated API resource —
 * routed straight to a support inbox by the contact module in
 * `apps/api`. Kept shape-compatible with what the marketing form on
 * the Strimz landing page already validates client-side.
 */

import { z } from 'zod'
import { emailSchema } from './common.js'

export const contactTopicSchema = z.enum(['sales', 'support', 'partnership', 'security', 'other'])
export type ContactTopic = z.infer<typeof contactTopicSchema>

export const contactRequestInputSchema = z.object({
  name: z.string().min(2).max(120),
  email: emailSchema,
  company: z.string().min(1).max(120).optional(),
  topic: contactTopicSchema,
  message: z.string().min(20).max(4000),
})
export type ContactRequestInput = z.infer<typeof contactRequestInputSchema>

export const contactRequestOutputSchema = z.object({
  ok: z.literal(true),
})
export type ContactRequestOutput = z.infer<typeof contactRequestOutputSchema>
