import { Module } from '@nestjs/common'
import { QueueModule } from '../../infra/queue/queue.module.js'
import { HealthController } from './health.controller.js'
import { ReadinessService } from './readiness.service.js'

@Module({ imports: [QueueModule], controllers: [HealthController], providers: [ReadinessService] })
export class HealthModule {}
