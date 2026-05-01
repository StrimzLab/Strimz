import { Module } from '@nestjs/common'
import { PricingService } from './pricing.service.js'
import { PricingCron } from './pricing.cron.js'

@Module({ providers: [PricingService, PricingCron], exports: [PricingService] })
export class PricingModule {}
