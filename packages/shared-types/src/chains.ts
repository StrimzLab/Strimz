/**
 * Chain registry — public type for the `SupportedChain` row.
 *
 * Surfaced in the admin platform's `/admin/chains` UI and queried by the
 * checkout to render the chain picker. `rpcConfig` is intentionally a
 * `Record<string, unknown>` here — the adapter package narrows it
 * per-family. Don't add chain-specific fields to this schema.
 */

import { z } from 'zod'
import { chainIdSchema, isoTimestampSchema } from './common.js'

export const chainFamilySchema = z.enum(['evm', 'stellar'])
export type ChainFamily = z.infer<typeof chainFamilySchema>

export const supportedChainSchema = z.object({
  id: chainIdSchema,
  family: chainFamilySchema,
  display: z.string().min(1).max(40),
  iconAsset: z.string().nullable(),
  enabled: z.boolean(),
  rpcConfig: z.record(z.string(), z.unknown()),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
})
export type SupportedChain = z.infer<typeof supportedChainSchema>
