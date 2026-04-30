import { Module } from '@nestjs/common'
import { SubscriptionDueWorker } from './subscription-due.worker.js'

@Module({ providers: [SubscriptionDueWorker] })
export class SubscriptionDueModule {}
