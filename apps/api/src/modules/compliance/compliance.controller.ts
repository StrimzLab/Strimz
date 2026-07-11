import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { PrivyAuthGuard } from '../../common/guards/privy.guard.js'
import {
  CurrentMerchant,
  type CurrentMerchantPayload,
} from '../../common/decorators/current-merchant.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { listQuerySchema, type ListQuery } from '../../common/schemas/list-query.js'
import { ComplianceService } from './compliance.service.js'

@ApiTags('compliance')
@ApiBearerAuth()
@UseGuards(PrivyAuthGuard)
@Controller('/v1/compliance')
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @Get('/logs')
  @ApiOperation({ summary: 'List compliance screening results scoped to the current merchant.' })
  listLogs(
    @CurrentMerchant() ctx: CurrentMerchantPayload,
    @Query(new ZodValidationPipe(listQuerySchema)) q: ListQuery,
  ) {
    return this.compliance.listLogs(ctx.merchantId, {
      limit: q.limit,
      cursor: q.cursor ?? null,
      status: q.status,
    })
  }
}
