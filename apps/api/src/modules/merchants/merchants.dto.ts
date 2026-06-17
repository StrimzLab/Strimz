import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import {
  changeTierInputSchema,
  onboardMerchantInputSchema,
  updateMerchantInputSchema,
} from '@strimz/shared-types'

export class UpdateMerchantDto extends createZodDto(updateMerchantInputSchema) {}
export class ChangeTierDto extends createZodDto(changeTierInputSchema) {}

/**
 * Onboard DTO mirrors the shared `onboardMerchantInputSchema` exactly —
 * keeping a single zod definition means the frontend, the SDK, and this
 * controller all validate against the same shape. Per-chain address
 * format validation runs in the service layer via the chain-adapter
 * registry; the schema only enforces the map structure here.
 */
export class OnboardDto extends createZodDto(onboardMerchantInputSchema) {}
export type OnboardInput = z.infer<typeof onboardMerchantInputSchema>
