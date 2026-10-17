import { createHash } from 'node:crypto'
import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common'
import { HTTP_CODE_METADATA } from '@nestjs/common/constants.js'
import { Reflector } from '@nestjs/core'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { catchError, from, mergeMap, of, throwError, type Observable } from 'rxjs'

import { SKIP_IDEMPOTENCY_KEY } from '../decorators/skip-idempotency.decorator.js'
import { RedisService } from '../../infra/redis/redis.service.js'

export const IDEMPOTENCY_HEADER = 'X-Strimz-Idempotency-Key'
export const REPLAYED_HEADER = 'X-Strimz-Idempotent-Replayed'

const KEY_PATTERN = /^[\x21-\x7e]{1,255}$/
const IN_PROGRESS_TTL_S = 60
const RESULT_TTL_S = 24 * 60 * 60

interface InProgress {
  state: 'in_progress'
  fingerprint: string
}

interface Done {
  state: 'done'
  fingerprint: string
  status: number
  body: unknown
}

type Claim = { kind: 'run' } | { kind: 'replay'; record: Done }

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly log = new Logger(IdempotencyInterceptor.name)

  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<FastifyRequest>()
    const header = req.headers[IDEMPOTENCY_HEADER.toLowerCase()]
    if (header === undefined || !req.merchant) return next.handle()
    if (req.method !== 'POST' && req.method !== 'PATCH') return next.handle()
    const skip = this.reflector.getAllAndOverride<boolean | undefined>(SKIP_IDEMPOTENCY_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (skip) return next.handle()

    if (typeof header !== 'string' || !KEY_PATTERN.test(header)) {
      throw new HttpException(
        {
          code: 'invalid_request',
          message: `${IDEMPOTENCY_HEADER} must be 1 to 255 visible ASCII characters`,
          param: IDEMPOTENCY_HEADER,
        },
        HttpStatus.BAD_REQUEST,
      )
    }

    const reply = context.switchToHttp().getResponse<FastifyReply>()
    const redisKey = `idem:${req.merchant.merchantId}:${req.merchant.mode}:${header}`
    const fingerprint = fingerprintOf(req)
    const successStatus =
      this.reflector.get<number | undefined>(HTTP_CODE_METADATA, context.getHandler()) ??
      (req.method === 'POST' ? HttpStatus.CREATED : HttpStatus.OK)

    return from(this.claim(redisKey, fingerprint, reply)).pipe(
      mergeMap((claim) => {
        if (claim.kind === 'replay') {
          void reply.header(REPLAYED_HEADER, 'true')
          const { status, body } = claim.record
          return status < 400
            ? of(body)
            : throwError(() => new HttpException(body as object, status))
        }
        return next.handle().pipe(
          mergeMap((body) =>
            from(this.store(redisKey, fingerprint, successStatus, body)).pipe(
              mergeMap(() => of(body)),
            ),
          ),
          catchError((err: unknown) => {
            const { status, body } = errorRecord(err)
            return from(this.store(redisKey, fingerprint, status, body)).pipe(
              mergeMap(() => throwError(() => err)),
            )
          }),
        )
      }),
    )
  }

  private async claim(redisKey: string, fingerprint: string, reply: FastifyReply): Promise<Claim> {
    const marker: InProgress = { state: 'in_progress', fingerprint }
    const claimed = await this.redisCall(() =>
      this.redis.client.set(redisKey, JSON.stringify(marker), 'EX', IN_PROGRESS_TTL_S, 'NX'),
    )
    if (claimed === 'OK') return { kind: 'run' }

    const raw = await this.redisCall(() => this.redis.client.get(redisKey))
    // The record expired between SET NX and GET; claim again.
    if (raw === null) return this.claim(redisKey, fingerprint, reply)
    const record = JSON.parse(raw) as InProgress | Done
    if (record.fingerprint !== fingerprint) {
      throw new HttpException(
        {
          code: 'idempotency_error',
          message: 'This idempotency key was used with a different request',
        },
        HttpStatus.CONFLICT,
      )
    }
    if (record.state === 'in_progress') {
      void reply.header('Retry-After', '1')
      throw new HttpException(
        {
          code: 'idempotency_in_progress',
          message: 'A request with this idempotency key is still running; retry shortly',
          retryAfterSec: 1,
        },
        HttpStatus.CONFLICT,
      )
    }
    return { kind: 'replay', record }
  }

  private async store(redisKey: string, fingerprint: string, status: number, body: unknown) {
    const record: Done = { state: 'done', fingerprint, status, body }
    try {
      await this.redis.client.set(redisKey, JSON.stringify(record), 'EX', RESULT_TTL_S)
    } catch (err) {
      // The write already happened, so the caller still gets its answer.
      this.log.error(`could not store idempotency result for ${redisKey}: ${String(err)}`)
    }
  }

  private async redisCall<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (err) {
      this.log.error(`idempotency store unavailable: ${String(err)}`)
      throw new HttpException(
        { code: 'service_unavailable', message: 'Temporarily unable to process writes; retry' },
        HttpStatus.SERVICE_UNAVAILABLE,
      )
    }
  }
}

function fingerprintOf(req: FastifyRequest): string {
  return createHash('sha256')
    .update(req.method)
    .update('\n')
    .update(req.url)
    .update('\n')
    .update(JSON.stringify(req.body ?? null))
    .digest('hex')
}

function errorRecord(err: unknown): { status: number; body: unknown } {
  if (err instanceof HttpException) return { status: err.getStatus(), body: err.getResponse() }
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    body: { error: { code: 'api_error', message: 'Internal server error' } },
  }
}
