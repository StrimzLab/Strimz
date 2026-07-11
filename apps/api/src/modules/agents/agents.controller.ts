import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { MerchantAuthGuard } from '../../common/guards/merchant-auth.guard.js'
import {
  CurrentMerchant,
  type CurrentMerchantPayload,
} from '../../common/decorators/current-merchant.decorator.js'
import { RequireScopes } from '../../common/decorators/scopes.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { listQuerySchema, type ListQuery } from '../../common/schemas/list-query.js'
import { AgentsService } from './agents.service.js'
import { CreateAgentJobDto, UpdateAgentConfigDto } from './agents.dto.js'

@ApiTags('agents')
@ApiBearerAuth()
@UseGuards(MerchantAuthGuard)
@Controller('/v1/agents')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @RequireScopes('agents_read')
  @Get('/config')
  @ApiOperation({ summary: 'Read AutoPay Agent configuration for the current merchant.' })
  retrieveConfig(@CurrentMerchant() ctx: CurrentMerchantPayload) {
    return this.agents.retrieveConfig(ctx.merchantId)
  }

  @RequireScopes('agents_write')
  @Patch('/config')
  @ApiOperation({
    summary: 'Update AutoPay Agent configuration. Partial — sends only changed fields.',
  })
  updateConfig(@CurrentMerchant() ctx: CurrentMerchantPayload, @Body() dto: UpdateAgentConfigDto) {
    return this.agents.updateConfig(ctx.merchantId, dto)
  }

  @RequireScopes('agents_read')
  @Get('/activity')
  @ApiOperation({ summary: 'Paginated activity log for AutoPay Agent.' })
  listActivity(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Query(new ZodValidationPipe(listQuerySchema)) q: ListQuery,
  ) {
    return this.agents.listActivity(ctx.merchantId, {
      limit: q.limit,
      cursor: q.cursor ?? null,
      capability: q.capability,
      outcome: q.outcome,
    })
  }

  @RequireScopes('agents_read')
  @Get('/jobs')
  listJobs(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Query(new ZodValidationPipe(listQuerySchema)) q: ListQuery,
  ) {
    return this.agents.listJobs(ctx.merchantId, {
      limit: q.limit,
      cursor: q.cursor ?? null,
      status: q.status,
    })
  }

  @RequireScopes('agents_read')
  @Get('/jobs/:id')
  retrieveJob(@CurrentMerchant() ctx: CurrentMerchantPayload, @Param('id') id: string) {
    return this.agents.retrieveJob(ctx.merchantId, id)
  }

  @RequireScopes('agents_write')
  @Post('/jobs')
  @ApiOperation({
    summary:
      'Create an ERC-8183 escrow job. Auto-approves below the merchant-configured threshold.',
  })
  createJob(@CurrentMerchant() ctx: CurrentMerchantPayload, @Body() dto: CreateAgentJobDto) {
    return this.agents.createJob(ctx.merchantId, dto)
  }

  @RequireScopes('agents_write')
  @Post('/jobs/:id/approve')
  @ApiOperation({ summary: 'Human-approve a job that needed manual sign-off.' })
  approveJob(@CurrentMerchant() ctx: CurrentMerchantPayload, @Param('id') id: string) {
    return this.agents.approveJob(ctx.merchantId, id)
  }
}
