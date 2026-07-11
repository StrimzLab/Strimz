import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { createBroadcastInputSchema } from '@strimz/shared-types'

export const setMerchantStatusInputSchema = z.object({
  status: z.enum(['active', 'suspended', 'closed']),
})
export class SetMerchantStatusDto extends createZodDto(setMerchantStatusInputSchema) {}

export const setMerchantTierInputSchema = z.object({
  tier: z.enum(['free', 'growth', 'business', 'enterprise']),
})
export class SetMerchantTierDto extends createZodDto(setMerchantTierInputSchema) {}

export const inviteAdminInputSchema = z.object({
  email: z.string().email().max(320),
  name: z.string().min(1).max(120).optional(),
  role: z.enum(['super_admin', 'admin', 'read_only']),
})
export class InviteAdminDto extends createZodDto(inviteAdminInputSchema) {}

export const setAdminRoleInputSchema = z.object({
  role: z.enum(['super_admin', 'admin', 'read_only']),
})
export class SetAdminRoleDto extends createZodDto(setAdminRoleInputSchema) {}

export const setAdminStatusInputSchema = z.object({
  status: z.enum(['active', 'suspended']),
})
export class SetAdminStatusDto extends createZodDto(setAdminStatusInputSchema) {}

/**
 * Body for POST /v1/admin/broadcasts. Shape lives in
 * `@strimz/shared-types` so the admin dashboard's client-side form
 * validates against the same rules the server enforces.
 */
export class CreateBroadcastDto extends createZodDto(createBroadcastInputSchema) {}
