import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'

import { RequireAdminRoles } from '../../common/decorators/admin-role.decorator.js'
import {
  CurrentAdmin,
  type CurrentAdminPayload,
} from '../../common/decorators/current-admin.decorator.js'
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { safeActionSchema, type SafeAction } from './safe-actions.js'
import { SafeService } from './safe.service.js'

const proposeBody = z.object({ action: safeActionSchema }).strict()
const signBody = z
  .object({ signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/u, 'a 65-byte hex signature') })
  .strict()

// ADR-2026-11-23-safe-console. Owners sign in their own wallets; nothing here holds a Safe key.
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@RequireAdminRoles('super_admin')
@Controller('/v1/admin/safe')
export class SafeController {
  constructor(private readonly safe: SafeService) {}

  @Get('/')
  @ApiOperation({ summary: 'The Safe, its owners and threshold, read from the chain.' })
  state() {
    return this.safe.state()
  }

  @Get('/proposals')
  @ApiOperation({ summary: 'Recent Safe proposals with their signatures.' })
  list() {
    return this.safe.list()
  }

  @Post('/proposals')
  @ApiOperation({ summary: 'Propose an action from the Safe menu.' })
  propose(
    @CurrentAdmin() ctx: CurrentAdminPayload,
    @Body(new ZodValidationPipe(proposeBody)) body: { action: SafeAction },
  ) {
    return this.safe.propose(body.action, ctx.adminId)
  }

  @Post('/proposals/:id/signatures')
  @HttpCode(200)
  @ApiOperation({ summary: "Add an owner's signature over the proposal's Safe transaction hash." })
  sign(
    @CurrentAdmin() ctx: CurrentAdminPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(signBody)) body: { signature: string },
  ) {
    return this.safe.sign(id, body.signature, ctx.adminId)
  }

  @Post('/proposals/:id/execute')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send a fully signed proposal from the relayer, which pays the gas.' })
  execute(@CurrentAdmin() ctx: CurrentAdminPayload, @Param('id') id: string) {
    return this.safe.execute(id, ctx.adminId)
  }

  @Post('/proposals/:id/timelock-execute')
  @ApiOperation({ summary: 'Propose running a scheduled Timelock operation once it is ready.' })
  timelockExecute(@CurrentAdmin() ctx: CurrentAdminPayload, @Param('id') id: string) {
    return this.safe.proposeTimelockExecute(id, ctx.adminId)
  }
}
