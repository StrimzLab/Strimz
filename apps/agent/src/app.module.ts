import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { StrimzConfigModule } from './config/index.js'
import { PrismaModule } from './infra/prisma/prisma.module.js'
import { EmailModule } from './infra/email/email.module.js'
import { ActivityLogModule } from './infra/activity-log/activity-log.module.js'
import { QueueModule } from './infra/queue/queue.module.js'
import { CircleAttestationModule } from './infra/circle-attestation/circle-attestation.module.js'
import { RecoveryModule } from './capabilities/recovery/recovery.module.js'
import { CashflowModule } from './capabilities/cashflow/cashflow.module.js'
import { CommerceModule } from './capabilities/commerce/commerce.module.js'
import { PricingModule } from './capabilities/pricing/pricing.module.js'
import { RoutingModule } from './capabilities/routing/routing.module.js'
import { HealthModule } from './common/health/health.module.js'

@Module({
  imports: [
    StrimzConfigModule,
    PrismaModule,
    EmailModule,
    ActivityLogModule,
    QueueModule,
    CircleAttestationModule,
    ScheduleModule.forRoot(),

    // Capabilities
    RecoveryModule,
    CashflowModule,
    CommerceModule,
    PricingModule,
    RoutingModule,

    // Public surface
    HealthModule,
  ],
})
export class AppModule {}
