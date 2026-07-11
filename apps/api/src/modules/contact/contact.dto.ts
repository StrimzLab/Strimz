import { createZodDto } from 'nestjs-zod'
import { contactRequestInputSchema } from '@strimz/shared-types'

/**
 * Zod-backed DTO for `POST /v1/contact`. Shape is defined in
 * `@strimz/shared-types` so the marketing form's client-side
 * validation and the API's server-side validation drift never.
 */
export class ContactRequestDto extends createZodDto(contactRequestInputSchema) {}
