import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'
import { SchedulerRegistry } from '@nestjs/schedule'
import { TypedConfigService } from '../../config/index.js'
import { scheduleCron } from '../../common/cron/schedule-cron.js'
import { CommerceService } from './commerce.service.js'

@Injectable()
export class CommerceCron implements OnApplicationBootstrap {
  private readonly log = new Logger(CommerceCron.name)
  constructor(
    private readonly commerce: CommerceService,
    private readonly cfg: TypedConfigService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onApplicationBootstrap(): void {
    scheduleCron(
      this.scheduler,
      'commerce-monthly',
      this.cfg.env.COMMERCE_MONTHLY_CRON,
      () => this.tick(),
      this.log,
    )
  }

  async tick(): Promise<void> {
    const r = await this.commerce.tick()
    this.log.log(`commerce monthly: sent=${r.sent} skipped=${r.skipped}`)
  }
}
