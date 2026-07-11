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

/**
 * Underscore-separated. The wire format and any database representation
 * use the same form so there is no boundary translation.
 */
export const apiKeyScopeSchema = z.enum([
  'sessions_read',
  'sessions_write',
  'subscriptions_read',
  'subscriptions_write',
  'refunds_read',
  'refunds_write',
  'transactions_read',
  'webhooks_read',
  'webhooks_write',
  'invoices_read',
  'invoices_write',
  'storefronts_read',
  'storefronts_write',
  'agents_read',
  'agents_write',
  // Meta-tx relayer. Submitting payer-signed EIP-3009 / EIP-2612
  // authorizations on the merchant's behalf. Granted to keys used by
  // hosted checkout and merchants embedding the SDK.
  'relay_read',
  'relay_write',
  // Self-service key management from an API key holder. Rarely used
  // day-to-day; needed for partner onboarding flows that mint scoped
  // keys per sub-tenant.
  'api_keys_read',
  'api_keys_write',
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
  /** Full plaintext key. Shown exactly once. */
  secret: z.string(),
})
export type CreateApiKeyOutput = z.infer<typeof createApiKeyOutputSchema>

export const rotateApiKeyInputSchema = z.object({
  id: idSchema,
})
export type RotateApiKeyInput = z.infer<typeof rotateApiKeyInputSchema>
