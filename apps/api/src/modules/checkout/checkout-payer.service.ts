import { ConflictException, Injectable } from '@nestjs/common'

import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { CustomersService } from '../customers/customers.service.js'
import { PaymentSessionsService } from '../payment-sessions/payment-sessions.service.js'
import { SubscriptionPlansService } from '../subscription-plans/subscription-plans.service.js'

export interface PayerIdentity {
  walletAddress: string
  email: string
}

@Injectable()
export class CheckoutPayerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customers: CustomersService,
    private readonly sessions: PaymentSessionsService,
    private readonly plans: SubscriptionPlansService,
  ) {}

  async attachToSession(sessionId: string, payer: PayerIdentity): Promise<{ customerId: string }> {
    const session = await this.sessions.retrievePublic(sessionId)
    return this.prisma.db.$transaction(async (tx) => {
      const customer = await this.customers.upsertFromCheckout(
        { merchantId: session.merchantId, ...payer },
        tx,
      )
      await this.sessions.bindCustomer(tx, sessionId, customer.id)
      return { customerId: customer.id }
    })
  }

  async attachToPlan(planId: string, payer: PayerIdentity): Promise<{ customerId: string }> {
    const plan = await this.plans.retrievePublic(planId)
    if (plan.status !== 'active') {
      throw new ConflictException({
        code: 'plan_not_active',
        message: 'this subscription plan is no longer offered',
      })
    }
    const customer = await this.customers.upsertFromCheckout({
      merchantId: plan.merchantId,
      ...payer,
    })
    return { customerId: customer.id }
  }
}
