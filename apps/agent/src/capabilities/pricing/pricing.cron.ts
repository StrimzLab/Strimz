import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PricingService } from './pricing.service.js'

@Injectable()
export class PricingCron {
  private readonly log = new Logger(PricingCron.name)
  constructor(private readonly pricing: PricingService) {}

  @Cron(process.env.PRICING_MONTHLY_CRON || '0 0 9 1 * *', { name: 'pricing-monthly' })
  async tick(): Promise<void> {
    const r = await this.pricing.tick()
    this.log.log(`pricing monthly: sent=${r.sent}`)
  }
}
