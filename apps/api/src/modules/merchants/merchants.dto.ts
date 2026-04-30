import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import {
  changeTierInputSchema,
  evmAddressSchema,
  paymentCurrencySchema,
  updateMerchantInputSchema,
} from '@strimz/shared-types'

export class UpdateMerchantDto extends createZodDto(updateMerchantInputSchema) {}
export class ChangeTierDto extends createZodDto(changeTierInputSchema) {}

const onboardSchema = z.object({
  businessName: z.string().min(2).max(120),
  businessSector: z.string().min(2).max(80),
  countryCode: z.string().length(2).regex(/^[A-Z]{2}$/, 'must be a 2-letter ISO country code'),
  websiteUrl: z.string().url().optional(),
  phone: z.string().min(6).max(20).optional(),
  payoutAddress: evmAddressSchema,
  defaultCurrency: paymentCurrencySchema.optional(),
})

export class OnboardDto extends createZodDto(onboardSchema) {}
export type OnboardInput = z.infer<typeof onboardSchema>
