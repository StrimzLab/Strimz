import { createZodDto } from 'nestjs-zod'
import {
  createStorefrontInputSchema,
  createStorefrontProductInputSchema,
  storefrontCheckoutInputSchema,
} from '@strimz/shared-types'

export class CreateStorefrontDto extends createZodDto(createStorefrontInputSchema) {}
export class CreateStorefrontProductDto extends createZodDto(createStorefrontProductInputSchema) {}
export class StorefrontCheckoutDto extends createZodDto(storefrontCheckoutInputSchema) {}
