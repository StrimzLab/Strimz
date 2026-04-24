/**
 * API keys.
 *
 * A merchant has independent test and live keys. The full secret is shown
 * exactly once at creation; the backend stores only a hash and a display prefix.
 */

import { z } from 'zod'
import { idSchema, isoTimestampSchema, modeSchema } from './common.js'

export const apiKeyKindSchema = z.enum(['secret', 'publishable'])
export type ApiKeyKind = z.infer<typeof apiKeyKindSchema>

export const apiKeyScopeSchema = z.enum([
  'sessions:read',
  'sessions:write',
  'subscriptions:read',
  'subscriptions:write',
  'refunds:read',
  'refunds:write',
  'transactions:read',
  'webhooks:read',
  'webhooks:write',
  'invoices:read',
  'invoices:write',
  'storefronts:read',
  'storefronts:write',
  'agents:read',
  'agents:write',
])
export type ApiKeyScope = z.infer<typeof apiKeyScopeSchema>

export const apiKeySchema = z.object({
  id: idSchema,
  merchantId: idSchema,
  name: z.string().min(1).max(60),
  kind: apiKeyKindSchema,
  mode: modeSchema,
  prefix: z.string().min(8).max(24),
  lastFour: z.string().length(4),
  scopes: z.array(apiKeyScopeSchema).nonempty(),
  createdAt: isoTimestampSchema,
  lastUsedAt: isoTimestampSchema.nullable(),
  revokedAt: isoTimestampSchema.nullable(),
})
export type ApiKey = z.infer<typeof apiKeySchema>

// ---------- DTOs ----------

export const createApiKeyInputSchema = z.object({
  name: z.string().min(1).max(60),
  kind: apiKeyKindSchema,
  mode: modeSchema,
  scopes: z.array(apiKeyScopeSchema).nonempty(),
})
export type CreateApiKeyInput = z.infer<typeof createApiKeyInputSchema>

export const createApiKeyOutputSchema = z.object({
  apiKey: apiKeySchema,
  /** Full plaintext key — shown exactly once. */
  secret: z.string(),
})
export type CreateApiKeyOutput = z.infer<typeof createApiKeyOutputSchema>

export const rotateApiKeyInputSchema = z.object({
  id: idSchema,
})
export type RotateApiKeyInput = z.infer<typeof rotateApiKeyInputSchema>
