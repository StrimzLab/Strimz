import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { FastifyRequest } from 'fastify'
import { z } from 'zod'

import { Public } from '../../common/decorators/public.decorator.js'
import { TypedConfigService } from '../../config/index.js'
import { PrivyWebhookService } from './privy-webhook.service.js'
import { readSvixHeaders, verifySvix } from './privy-webhook.verify.js'

// Only the fields we actually use. Privy sends more but we ignore it.
const eventSchema = z.object({
  type: z.string().min(1),
  data: z
    .object({
      user: z
        .object({
          id: z.string().optional(),
          email: z.object({ address: z.string() }).optional(),
          linked_accounts: z.array(z.record(z.unknown())).optional(),
        })
        .optional(),
    })
    .optional(),
})

@ApiTags('auth')
@Controller('/v1/auth/privy-webhook')
export class PrivyWebhookController {
  private readonly log = new Logger(PrivyWebhookController.name)

  constructor(
    private readonly cfg: TypedConfigService,
    private readonly svc: PrivyWebhookService,
  ) {}

  // Public: signature is the credential.
  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  async receive(@Req() req: FastifyRequest): Promise<{ ok: true }> {
    const secret = this.cfg.env.PRIVY_WEBHOOK_SIGNING_SECRET
    if (!secret) throw new UnauthorizedException({ code: 'not_configured' })

    const sig = readSvixHeaders(req.headers as Record<string, string | string[] | undefined>)
    if (!sig) throw new UnauthorizedException({ code: 'missing_signature_headers' })

    const rawBody =
      req.rawBody ?? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
    if (!verifySvix(rawBody, sig, secret)) {
      this.log.warn(`privy webhook: bad signature id=${sig.id}`)
      throw new UnauthorizedException({ code: 'invalid_signature' })
    }

    let payload: z.infer<typeof eventSchema>
    try {
      payload = eventSchema.parse(JSON.parse(rawBody))
    } catch (err) {
      throw new BadRequestException({
        code: 'invalid_payload',
        message: (err as Error).message,
      })
    }

    await this.svc.handleEvent(payload)
    return { ok: true }
  }
}
