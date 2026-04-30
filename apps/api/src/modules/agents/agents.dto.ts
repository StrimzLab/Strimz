import { createZodDto } from 'nestjs-zod'
import { createAgentJobInputSchema, updateAgentConfigInputSchema } from '@strimz/shared-types'

export class UpdateAgentConfigDto extends createZodDto(updateAgentConfigInputSchema) {}
export class CreateAgentJobDto extends createZodDto(createAgentJobInputSchema) {}
