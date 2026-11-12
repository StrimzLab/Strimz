import { z } from 'zod'
import { idSchema, isoTimestampSchema } from '@strimz/shared-types'

// Shared shape for `/list?limit=&cursor=&status=&query=&...` endpoints.
// Bounds every field so a caller can't force expensive scans with a
// huge `query` or a hostile status filter. Routes narrow list filters
// to their own enums with `enumList`.

const statusToken = z
  .string()
  .max(48)
  .regex(/^[a-zA-Z0-9._-]+$/u, 'invalid status')

// `a,b,c` → ['a','b','c']: trimmed, de-duplicated, 1 to 20 values.
function listOf<T extends z.ZodTypeAny>(item: T, normalise: (v: string) => string = (v) => v) {
  return z
    .string()
    .max(1000)
    .transform((v) => [...new Set(v.split(',').map((s) => normalise(s.trim())))].filter(Boolean))
    .pipe(z.array(item).min(1, 'expected at least one value').max(20))
}

const tokenList = listOf(statusToken)

export function enumList<E extends Record<string, string>>(
  values: E,
  normalise?: (v: string) => string,
) {
  return listOf(z.nativeEnum(values), normalise)
}

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
    status: tokenList.optional(),
    tier: tokenList.optional(),
    kind: tokenList.optional(),
    capability: tokenList.optional(),
    outcome: tokenList.optional(),
    eventName: tokenList.optional(),
    endpointId: z.string().uuid().optional(),
    planId: z.string().max(64).optional(),
    sessionId: idSchema.optional(),
    subscriptionId: idSchema.optional(),
    customerId: idSchema.optional(),
    audience: statusToken.optional(),
    query: searchQuery.optional(),
    revoked: z.enum(['true', 'false']).optional(),
  })
  .strict()

export type ListQuery = z.infer<typeof listQuerySchema>

// Half-open: from is inclusive, to is exclusive, so consecutive months never overlap.
// Only routes that filter on a date use this; the rest keep refusing from/to.
const dateFields = {
  from: isoTimestampSchema.transform((v) => new Date(v)).optional(),
  to: isoTimestampSchema.transform((v) => new Date(v)).optional(),
}

export function withDateRange<T extends z.ZodRawShape, U extends z.UnknownKeysParam>(
  schema: z.ZodObject<T, U>,
) {
  return schema.extend(dateFields).superRefine((q, ctx) => {
    if (q.from && q.to && q.from >= q.to) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'must be after from' })
    }
  })
}

export const datedListQuerySchema = withDateRange(listQuerySchema)

export type DatedListQuery = z.infer<typeof datedListQuerySchema>

export function dateRange(q: { from?: Date; to?: Date }) {
  if (!q.from && !q.to) return undefined
  return { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lt: q.to } : {}) }
}

export function anyOf<T>(values?: readonly T[]) {
  return values ? { in: [...values] } : undefined
}
