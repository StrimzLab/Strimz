import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

/**
 * Body for `POST /v1/checkout/sessions/:id/payer` and the plans-scoped
 * sibling. The payer types their email on the hosted checkout page
 * once they have connected a wallet. We upsert a Customer row on the
 * merchant so receipts can fire on-chain confirmation.
 */
export const payerIdentityInputSchema = z.object({
  email: z.string().email().max(320),
  walletAddress: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/u, { message: 'walletAddress must be a 0x-prefixed EVM address' }),
})

export type PayerIdentityInput = z.infer<typeof payerIdentityInputSchema>

export class PayerIdentityDto extends createZodDto(payerIdentityInputSchema) {}
