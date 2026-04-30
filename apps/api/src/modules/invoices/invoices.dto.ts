import { createZodDto } from 'nestjs-zod'
import { createInvoiceInputSchema } from '@strimz/shared-types'

export class CreateInvoiceDto extends createZodDto(createInvoiceInputSchema) {}
