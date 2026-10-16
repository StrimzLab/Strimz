import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'
import { SchedulerRegistry } from '@nestjs/schedule'
import { TypedConfigService } from '../../config/index.js'
import { scheduleCron } from '../../common/cron/schedule-cron.js'
import { CashflowDigestService } from './digest.service.js'
import { CashflowAnomalyService } from './anomaly.service.js'
import { CashflowYieldService } from './yield-recommendation.service.js'

@Injectable()
export class CashflowCron implements OnApplicationBootstrap {
  private readonly log = new Logger(CashflowCron.name)

  constructor(
    private readonly digest: CashflowDigestService,
    private readonly anomaly: CashflowAnomalyService,
    private readonly yieldRec: CashflowYieldService,
    private readonly cfg: TypedConfigService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onApplicationBootstrap(): void {
    const env = this.cfg.env
    scheduleCron(
      this.scheduler,
      'cashflow-digest',
      env.CASHFLOW_DIGEST_CRON,
      () => this.digestTick(),
      this.log,
    )
    scheduleCron(
      this.scheduler,
      'cashflow-anomaly',
      env.CASHFLOW_ANOMALY_CRON,
      () => this.anomalyTick(),
      this.log,
    )
    scheduleCron(
      this.scheduler,
      'cashflow-yield',
      env.CASHFLOW_YIELD_CRON,
      () => this.yieldTick(),
      this.log,
    )
  }

  async digestTick(): Promise<void> {
    const r = await this.digest.tick()
    this.log.log(`cashflow digest: sent=${r.sent} skipped=${r.skipped}`)
  }

  async anomalyTick(): Promise<void> {
    const r = await this.anomaly.tick()
    this.log.log(`cashflow anomaly: flagged=${r.flagged} checked=${r.checked}`)
  }

  async yieldTick(): Promise<void> {
    const r = await this.yieldRec.tick()
    this.log.log(`cashflow yield: recommended=${r.recommended} skipped=${r.skipped}`)
  }
}
