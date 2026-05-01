import { Global, Module } from '@nestjs/common'
import { ActivityLogService } from './activity-log.service.js'

@Global()
@Module({ providers: [ActivityLogService], exports: [ActivityLogService] })
export class ActivityLogModule {}
