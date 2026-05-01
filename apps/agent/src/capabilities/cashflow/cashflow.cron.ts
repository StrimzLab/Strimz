import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { CashflowDigestService } from './digest.service.js'
import { CashflowAnomalyService } from './anomaly.service.js'
import { CashflowYieldService } from './yield-recommendation.service.js'

@Injectable()
export class CashflowCron {
  private readonly log = new Logger(CashflowCron.name)

  constructor(
    private readonly digest: CashflowDigestService,
    private readonly anomaly: CashflowAnomalyService,
    private readonly yieldRec: CashflowYieldService,
  ) {}

  @Cron(process.env.CASHFLOW_DIGEST_CRON || '0 0 9 * * *', { name: 'cashflow-digest' })
  async digestTick(): Promise<void> {
    const r = await this.digest.tick()
    this.log.log(`cashflow digest: sent=${r.sent} skipped=${r.skipped}`)
  }

  @Cron(process.env.CASHFLOW_ANOMALY_CRON || '0 0 * * * *', { name: 'cashflow-anomaly' })
  async anomalyTick(): Promise<void> {
    const r = await this.anomaly.tick()
    this.log.log(`cashflow anomaly: flagged=${r.flagged} checked=${r.checked}`)
  }

  @Cron(process.env.CASHFLOW_YIELD_CRON || '0 30 9 * * *', { name: 'cashflow-yield' })
  async yieldTick(): Promise<void> {
    const r = await this.yieldRec.tick()
    this.log.log(`cashflow yield: recommended=${r.recommended} skipped=${r.skipped}`)
  }
}
