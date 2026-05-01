import { Module } from '@nestjs/common'
import { CashflowDigestService } from './digest.service.js'
import { CashflowAnomalyService } from './anomaly.service.js'
import { CashflowYieldService } from './yield-recommendation.service.js'
import { CashflowCron } from './cashflow.cron.js'

@Module({
  providers: [CashflowDigestService, CashflowAnomalyService, CashflowYieldService, CashflowCron],
  exports: [CashflowDigestService, CashflowAnomalyService, CashflowYieldService],
})
export class CashflowModule {}
