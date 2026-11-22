import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { FastifyRequest } from 'fastify'
import { z } from 'zod'

import {
  CurrentMerchant,
  type CurrentMerchantPayload,
} from '../../common/decorators/current-merchant.decorator.js'
import { RateLimit } from '../../common/decorators/rate-limit.decorator.js'
import { SessionOnly } from '../../common/decorators/session-only.decorator.js'
import { MerchantAuthGuard } from '../../common/guards/merchant-auth.guard.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { STEP_UP_ACTIONS, StepUpService } from './step-up.service.js'

const b64url = z
  .string()
  .min(1)
  .max(4096)
  .regex(/^[A-Za-z0-9_-]+={0,2}$/u)
const actionSchema = z.object({ action: z.enum(STEP_UP_ACTIONS) })
const verifySchema = actionSchema.extend({
  credential: z.object({
    id: b64url,
    raw_id: b64url,
    type: z.literal('public-key'),
    response: z.object({
      client_data_json: b64url,
      authenticator_data: b64url,
      signature: b64url,
      user_handle: b64url.optional(),
    }),
    client_extension_results: z.record(z.unknown()).optional(),
  }),
})

function bearer(req: FastifyRequest): string {
  return (req.headers.authorization ?? '').replace(/^Bearer\s+/u, '')
}

@ApiTags('auth')
@ApiBearerAuth()
@UseGuards(MerchantAuthGuard)
@Controller('/v1/auth/step-up')
export class StepUpController {
  constructor(private readonly stepUp: StepUpService) {}

  @SessionOnly()
  @RateLimit({ max: 20, windowMs: 60_000, keyBy: 'actor', label: 'auth.step_up' })
  @Post('/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a passkey confirmation for a sensitive action.' })
  async start(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Req() req: FastifyRequest,
    @Body(new ZodValidationPipe(actionSchema)) _body: z.infer<typeof actionSchema>,
  ) {
    return { options: await this.stepUp.start(ctx.merchantId, bearer(req)) }
  }

  @SessionOnly()
  @RateLimit({ max: 20, windowMs: 60_000, keyBy: 'actor', label: 'auth.step_up' })
  @Post('/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify the passkey and return a one-use token for the action.' })
  verify(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Req() req: FastifyRequest,
    @Body(new ZodValidationPipe(verifySchema)) body: z.infer<typeof verifySchema>,
  ) {
    return this.stepUp.verify(ctx.merchantId, bearer(req), body.action, body.credential)
  }
}
