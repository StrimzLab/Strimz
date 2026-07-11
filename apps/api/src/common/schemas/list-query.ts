import { z } from 'zod'

// Shared shape for `/list?limit=&cursor=&status=&query=&...` endpoints.
// Bounds every field so a caller can't force expensive scans with a
// huge `query` or a hostile status filter.

const statusToken = z
  .string()
  .max(48)
  .regex(/^[a-zA-Z0-9._-]+$/u, 'invalid status')

const searchQuery = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[\p{L}\p{N} @._+\-'&/]+$/u, 'invalid characters in query')

export const listQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    cursor: z.string().max(200).optional(),
    status: statusToken.optional(),
    tier: statusToken.optional(),
    kind: statusToken.optional(),
    capability: statusToken.optional(),
    outcome: statusToken.optional(),
    eventName: statusToken.optional(),
    endpointId: z.string().uuid().optional(),
    planId: z.string().max(64).optional(),
    audience: statusToken.optional(),
    query: searchQuery.optional(),
    revoked: z.enum(['true', 'false']).optional(),
  })
  .strict()

export type ListQuery = z.infer<typeof listQuerySchema>
