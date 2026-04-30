import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { createRefundInputSchema } from '@strimz/shared-types'
import { evmTxHashSchema } from '@strimz/shared-types'

export class CreateRefundDto extends createZodDto(createRefundInputSchema) {}

// `id` comes from the URL path; the body only carries the tx hash.
const submitSignatureBodySchema = z.object({ refundTxHash: evmTxHashSchema })
export class SubmitRefundSignatureDto extends createZodDto(submitSignatureBodySchema) {}
