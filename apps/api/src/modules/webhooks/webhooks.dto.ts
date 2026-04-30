import { createZodDto } from 'nestjs-zod'
import { createWebhookEndpointInputSchema } from '@strimz/shared-types'

export class CreateWebhookEndpointDto extends createZodDto(createWebhookEndpointInputSchema) {}
