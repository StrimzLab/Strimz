import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { CommerceService } from './commerce.service.js'

@Injectable()
export class CommerceCron {
  private readonly log = new Logger(CommerceCron.name)
  constructor(private readonly commerce: CommerceService) {}

  @Cron(process.env.COMMERCE_MONTHLY_CRON || '0 0 9 1 * *', { name: 'commerce-monthly' })
  async tick(): Promise<void> {
    const r = await this.commerce.tick()
    this.log.log(`commerce monthly: sent=${r.sent} skipped=${r.skipped}`)
  }
}
