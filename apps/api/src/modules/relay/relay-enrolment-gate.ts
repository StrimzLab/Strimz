import { BadRequestException, ConflictException, Injectable } from '@nestjs/common'

import { EnrolmentTermsService } from '../subscription-plans/enrolment-terms.service.js'
import { SubscriptionsService } from '../subscriptions/subscriptions.service.js'
import { RelayChainProbe } from './relay-chain-probe.js'
import type { PermitAndCreateSubscriptionInput } from './relay.types.js'

@Injectable()
export class RelayEnrolmentGate {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly enrolmentTerms: EnrolmentTermsService,
    private readonly probe: RelayChainProbe,
  ) {}

  async assertPlanTerms(
    merchantInternalId: string,
    input: PermitAndCreateSubscriptionInput,
  ): Promise<void> {
    // Block a wallet that already subscribes to this plan before spending gas.
    // subscriptionInternalId is the DB planId being enrolled into.
    if (!input.subscriptionInternalId) return
    const existing = await this.subscriptions.activeForPayer(
      input.subscriptionInternalId,
      input.permitData.owner,
    )
    if (existing.active) {
      throw new ConflictException({
        code: 'subscription_exists',
        message: 'this wallet already has an active subscription to this plan',
        subscriptionId: existing.subscriptionId,
      })
    }
    await this.enrolmentTerms.verify(merchantInternalId, {
      planId: input.subscriptionInternalId,
      payer: input.permitData.owner,
      merchantId: input.merchantId,
      token: input.token,
      amount: input.amount,
      interval: input.interval,
      startAt: input.startAt,
      endAt: input.endAt,
    })
  }

  async assertFunded(input: PermitAndCreateSubscriptionInput): Promise<void> {
    const balance = await this.probe.balanceOf(input.token, input.permitData.owner)
    if (balance >= input.amount) return
    throw new BadRequestException({
      code: 'insufficient_balance',
      message: 'the payer holds less than the subscription amount',
      details: { required: input.amount.toString() },
    })
  }
}
