import { CallHandler, ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { uuid } from '@strimz/shared-crypto'
import type { Observable } from 'rxjs'

const HEADER = 'x-strimz-request-id'

/**
 * Stamps every request/response with a request-id. Echoes any inbound
 * `X-Strimz-Request-Id` header; otherwise generates a fresh UUID v4.
 * The id is exposed on `req.id` for downstream interceptors and filters.
 */
@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<FastifyRequest & { id?: string }>()
    const res = context.switchToHttp().getResponse<FastifyReply>()
    const incoming = (req.headers[HEADER] as string | undefined) ?? undefined
    const id = incoming && /^[\w-]{8,128}$/.test(incoming) ? incoming : uuid()
    req.id = id
    void res.header(HEADER, id)
    return next.handle()
  }
}
