import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'
import { SchedulerRegistry } from '@nestjs/schedule'
import { TypedConfigService } from '../../config/index.js'
import { scheduleCron } from '../../common/cron/schedule-cron.js'
import { PricingService } from './pricing.service.js'

@Injectable()
export class PricingCron implements OnApplicationBootstrap {
  private readonly log = new Logger(PricingCron.name)
  constructor(
    private readonly pricing: PricingService,
    private readonly cfg: TypedConfigService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onApplicationBootstrap(): void {
    scheduleCron(
      this.scheduler,
      'pricing-monthly',
      this.cfg.env.PRICING_MONTHLY_CRON,
      () => this.tick(),
      this.log,
    )
  }

  async tick(): Promise<void> {
    const r = await this.pricing.tick()
    this.log.log(`pricing monthly: sent=${r.sent}`)
  }
}
