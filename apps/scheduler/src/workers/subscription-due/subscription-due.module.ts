import { Module } from '@nestjs/common'
import { AllowanceReminderService } from './allowance-reminder.service.js'
import { SubscriptionDueWorker } from './subscription-due.worker.js'

@Module({ providers: [SubscriptionDueWorker, AllowanceReminderService] })
export class SubscriptionDueModule {}
