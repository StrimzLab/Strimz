import { Module } from '@nestjs/common'
import { CommerceService } from './commerce.service.js'
import { CommerceCron } from './commerce.cron.js'

@Module({ providers: [CommerceService, CommerceCron], exports: [CommerceService] })
export class CommerceModule {}
