import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

// `id` comes from the URL path; the body only carries `reason`.
const cancelBodySchema = z.object({
  reason: z.string().max(500).optional(),
})
export class CancelSubscriptionDto extends createZodDto(cancelBodySchema) {}
