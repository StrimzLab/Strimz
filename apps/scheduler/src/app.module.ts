import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { StrimzConfigModule } from './config/index.js'
import { PrismaModule } from './infra/prisma/prisma.module.js'
import { RedisModule } from './infra/redis/redis.module.js'
import { QueueModule } from './infra/queue/queue.module.js'
import { ChainModule } from './infra/chain/chain.module.js'
import { WebhookSigningModule } from './infra/webhook-signing/signing.module.js'
import { EmailModule } from './infra/email/email.module.js'
import { WebhookDeliveryModule } from './workers/webhook-delivery/webhook-delivery.module.js'
import { SubscriptionDueModule } from './workers/subscription-due/subscription-due.module.js'
import { AgentActionModule } from './workers/agent-action/agent-action.module.js'
import { SubscriptionSweeperModule } from './crons/subscription-sweeper/subscription-sweeper.module.js'
import { InvoiceOverdueModule } from './crons/invoice-overdue/invoice-overdue.module.js'
import { HealthModule } from './common/health/health.module.js'

@Module({
  imports: [
    StrimzConfigModule,
    PrismaModule,
    RedisModule,
    QueueModule,
    ChainModule,
    WebhookSigningModule,
    EmailModule,
    ScheduleModule.forRoot(),

    // Workers
    WebhookDeliveryModule,
    SubscriptionDueModule,
    AgentActionModule,

    // Crons
    SubscriptionSweeperModule,
    InvoiceOverdueModule,

    // Public surface
    HealthModule,
  ],
})
export class AppModule {}
