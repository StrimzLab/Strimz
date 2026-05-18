import { Module } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { ZodValidationPipe } from 'nestjs-zod'

import { StrimzConfigModule } from './config/index.js'
import { PrismaModule } from './infra/prisma/prisma.module.js'
import { RedisModule } from './infra/redis/redis.module.js'
import { QueueModule } from './infra/queue/queue.module.js'
import { EmailModule } from './infra/email/email.module.js'
import { ChainModule } from './infra/chain/chain.module.js'
import { KmsModule } from './infra/kms/kms.module.js'
import { PrivyModule } from './infra/privy/privy.module.js'
import { TurnstileModule } from './infra/turnstile/turnstile.module.js'
import { WebhookEventModule } from './infra/events/webhook-event.module.js'

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js'
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor.js'

import { AuthModule } from './modules/auth/auth.module.js'
import { MerchantsModule } from './modules/merchants/merchants.module.js'
import { ApiKeysModule } from './modules/api-keys/api-keys.module.js'
import { CustomersModule } from './modules/customers/customers.module.js'
import { PaymentSessionsModule } from './modules/payment-sessions/payment-sessions.module.js'
import { TransactionsModule } from './modules/transactions/transactions.module.js'
import { SubscriptionPlansModule } from './modules/subscription-plans/subscription-plans.module.js'
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module.js'
import { RefundsModule } from './modules/refunds/refunds.module.js'
import { WebhooksModule } from './modules/webhooks/webhooks.module.js'
import { ComplianceModule } from './modules/compliance/compliance.module.js'
import { AnalyticsModule } from './modules/analytics/analytics.module.js'
import { AgentsModule } from './modules/agents/agents.module.js'
import { StorefrontsModule } from './modules/storefronts/storefronts.module.js'
import { InvoicesModule } from './modules/invoices/invoices.module.js'
import { HealthModule } from './modules/health/health.module.js'
import { RelayModule } from './modules/relay/relay.module.js'

@Module({
  imports: [
    StrimzConfigModule,
    PrismaModule,
    RedisModule,
    QueueModule,
    EmailModule,
    ChainModule,
    KmsModule,
    PrivyModule,
    TurnstileModule,
    WebhookEventModule,

    AuthModule,
    MerchantsModule,
    ApiKeysModule,
    CustomersModule,
    PaymentSessionsModule,
    TransactionsModule,
    SubscriptionPlansModule,
    SubscriptionsModule,
    RefundsModule,
    WebhooksModule,
    ComplianceModule,
    AnalyticsModule,
    AgentsModule,
    StorefrontsModule,
    InvoicesModule,
    HealthModule,
    RelayModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
    // Global Zod validation — every controller using a `createZodDto` class
    // gets validated automatically.
    { provide: APP_PIPE, useClass: ZodValidationPipe },
  ],
})
export class AppModule {}
