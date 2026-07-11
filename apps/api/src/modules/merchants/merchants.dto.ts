import { createZodDto } from 'nestjs-zod'
import {
  changeTierInputSchema,
  onboardMerchantInputSchema,
  updateMerchantInputSchema,
  type OnboardMerchantInput,
} from '@strimz/shared-types'

export class UpdateMerchantDto extends createZodDto(updateMerchantInputSchema) {}
export class ChangeTierDto extends createZodDto(changeTierInputSchema) {}

/** Shape is defined in `@strimz/shared-types` so the dashboard's client
 *  hook consumes the same schema. Keeping the DTO here just gives Nest
 *  a validation class it can @Body() against. */
export class OnboardDto extends createZodDto(onboardMerchantInputSchema) {}
export type OnboardInput = OnboardMerchantInput
