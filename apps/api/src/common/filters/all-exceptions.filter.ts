import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger, type ExceptionFilter } from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'

/**
 * Global exception filter — turns any thrown error into the Strimz error
 * envelope shape that the SDK expects:
 *
 *   { error: { code, message, requestId?, param?, details? } }
 *
 * HttpException already-shaped responses are passed through; everything
 * else maps to `api_error` with HTTP 500 and stack-trace logging.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly log = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<FastifyReply>()
    const req = ctx.getRequest<FastifyRequest & { id?: string }>()

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const body = exception.getResponse()
      const payload = normaliseHttpExceptionBody(body, status, req.id)
      void res.status(status).send(payload)
      return
    }

    const message = exception instanceof Error ? exception.message : 'Internal server error'
    this.log.error(message, exception instanceof Error ? exception.stack : undefined)
    void res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      error: {
        code: 'api_error',
        message: 'Internal server error',
        requestId: req.id,
      },
    })
  }
}

function normaliseHttpExceptionBody(body: unknown, status: number, requestId: string | undefined) {
  if (typeof body === 'string') {
    return { error: { code: codeForStatus(status), message: body, requestId } }
  }
  if (typeof body === 'object' && body !== null) {
    const obj = body as Record<string, unknown>
    // Already in Strimz error envelope shape?
    if ('error' in obj && typeof obj.error === 'object') return { ...obj, requestId }
    // NestJS BadRequest / etc shape: { statusCode, message, error }
    // nestjs-zod's BadRequestException carries `errors: ZodIssue[]` — surface
    // it as `details.issues` so SDK consumers (and tests) can introspect the
    // failure without the server needing to log full stacks.
    const issues = Array.isArray(obj.errors) ? obj.errors : undefined
    return {
      error: {
        code: typeof obj.code === 'string' ? obj.code : codeForStatus(status),
        message: typeof obj.message === 'string' ? obj.message : 'Request failed',
        param: typeof obj.param === 'string' ? obj.param : undefined,
        details: issues ? { issues } : obj.details,
        requestId,
      },
    }
  }
  return { error: { code: codeForStatus(status), message: 'Request failed', requestId } }
}

function codeForStatus(status: number): string {
  if (status === 400) return 'invalid_request'
  if (status === 401) return 'authentication_error'
  if (status === 403) return 'permission_denied'
  if (status === 404) return 'not_found'
  if (status === 409) return 'idempotency_error'
  if (status === 422) return 'invalid_request'
  if (status === 429) return 'rate_limited'
  return 'api_error'
}
