import { BadRequestException, Injectable, type PipeTransform, type ArgumentMetadata } from '@nestjs/common'
import type { z } from 'zod'

/**
 * Validates request bodies / queries / params against a Zod schema.
 *
 *   @Post() create(@Body(new ZodValidationPipe(createInputSchema)) input: CreateInput) { ... }
 *
 * On failure throws a `BadRequestException` whose payload is shaped as the
 * Strimz error envelope so the global exception filter renders it consistently.
 */
@Injectable()
export class ZodValidationPipe<T extends z.ZodTypeAny> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown, _metadata: ArgumentMetadata): z.output<T> {
    const result = this.schema.safeParse(value)
    if (!result.success) {
      const first = result.error.issues[0]
      throw new BadRequestException({
        code: 'invalid_request',
        message: first ? `${first.path.join('.')}: ${first.message}` : 'invalid request',
        param: first?.path.join('.'),
        details: { issues: result.error.issues },
      })
    }
    return result.data
  }
}
