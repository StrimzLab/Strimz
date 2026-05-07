import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ApiKeyGuard } from '../../common/guards/api-key.guard.js'
import {
  CurrentMerchant,
  type CurrentMerchantPayload,
} from '../../common/decorators/current-merchant.decorator.js'
import { RequireScopes } from '../../common/decorators/scopes.decorator.js'
import { AgentsService } from './agents.service.js'
import { CreateAgentJobDto, UpdateAgentConfigDto } from './agents.dto.js'

@ApiTags('agents')
@ApiBearerAuth()
@UseGuards(ApiKeyGuard)
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
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('capability') capability?: string,
    @Query('outcome') outcome?: string,
  ) {
    return this.agents.listActivity(ctx.merchantId, {
      limit: limit ? Number(limit) : undefined,
      cursor: cursor ?? null,
      capability,
      outcome,
    })
  }

  @RequireScopes('agents_read')
  @Get('/jobs')
  listJobs(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('status') status?: string,
  ) {
    return this.agents.listJobs(ctx.merchantId, {
      limit: limit ? Number(limit) : undefined,
      cursor: cursor ?? null,
      status,
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
