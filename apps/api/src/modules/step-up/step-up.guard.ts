import {
  applyDecorators,
  type CanActivate,
  type ExecutionContext,
  Injectable,
  SetMetadata,
  UseGuards,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { FastifyRequest } from 'fastify'

import { StepUpService, type StepUpAction } from './step-up.service.js'

const STEP_UP_KEY = 'stepUpAction'
export const STEP_UP_HEADER = 'x-strimz-step-up'

/** Dashboard sessions need a fresh passkey confirmation for this action; API keys don't. */
export const RequireStepUp = (action: StepUpAction) =>
  applyDecorators(SetMetadata(STEP_UP_KEY, action), UseGuards(StepUpGuard))

@Injectable()
export class StepUpGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly stepUp: StepUpService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const action = this.reflector.get<StepUpAction | undefined>(STEP_UP_KEY, ctx.getHandler())
    const req = ctx.switchToHttp().getRequest<FastifyRequest>()
    if (!action || !req.merchant || req.merchant.apiKeyId) return true
    const header = req.headers[STEP_UP_HEADER]
    await this.stepUp.consume(
      typeof header === 'string' ? header : undefined,
      req.merchant.merchantId,
      action,
    )
    return true
  }
}
