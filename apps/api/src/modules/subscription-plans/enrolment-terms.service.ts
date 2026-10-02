import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { PaymentCurrency, SubscriptionEnrolmentTerms } from '@strimz/shared-types'

import { TypedConfigService } from '../../config/index.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { tokenAddressForCurrency } from '../payment-sessions/token-resolver.js'
import { intervalSeconds } from './subscription-plans.service.js'

const SECONDS_PER_DAY = 86_400
const TRIAL_START_TOLERANCE_SECONDS = 15 * 60

export interface EnrolmentRequest {
  planId: string
  payer: string
  merchantId: bigint
  token: string
  amount: bigint
  interval: number
  startAt: bigint
  endAt: bigint
}

interface PlanForTerms {
  id: string
  trialPeriodDays: number | null
}

@Injectable()
export class EnrolmentTermsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: TypedConfigService,
  ) {}

  async quote(
    planId: string,
    payer: string,
    now = new Date(),
  ): Promise<SubscriptionEnrolmentTerms> {
    const payerAddress = normalisePayer(payer)
    const plan = await this.prisma.db.subscriptionPlan.findUnique({
      where: { id: planId },
      select: { id: true, trialPeriodDays: true },
    })
    if (!plan) throw new NotFoundException({ code: 'not_found', message: 'plan not found' })

    const trialDays = await this.trialDaysFor(plan, payerAddress)
    if (trialDays === 0) return { startAt: '0', trialDays: 0, trialEndsAt: null }

    const startAt = unixSeconds(now) + trialDays * SECONDS_PER_DAY
    return {
      startAt: String(startAt),
      trialDays,
      trialEndsAt: new Date(startAt * 1000).toISOString(),
    }
  }

  async verify(merchantId: string, req: EnrolmentRequest, now = new Date()): Promise<void> {
    const plan = await this.prisma.db.subscriptionPlan.findUnique({
      where: { id: req.planId },
      include: { merchant: { select: { onchainMerchantId: true } } },
    })
    if (!plan || plan.merchantId !== merchantId || plan.status !== 'active') {
      throw mismatch(['plan'])
    }

    const fields: string[] = []
    const onchainId = plan.merchant.onchainMerchantId
    if (onchainId === null || BigInt(onchainId) !== req.merchantId) fields.push('merchantId')
    const token = tokenAddressForCurrency(this.cfg, plan.currency as PaymentCurrency)
    if (token === null || token !== req.token.toLowerCase()) fields.push('token')
    if (BigInt(plan.amount) !== req.amount) fields.push('amount')
    if (intervalSeconds(plan.interval, plan.intervalCount) !== req.interval) fields.push('interval')
    if (req.endAt !== 0n) fields.push('endAt')

    const trialDays = await this.trialDaysFor(plan, normalisePayer(req.payer))
    if (trialDays === 0) {
      if (req.startAt !== 0n) fields.push('startAt')
    } else {
      const expected = BigInt(unixSeconds(now) + trialDays * SECONDS_PER_DAY)
      const drift = req.startAt > expected ? req.startAt - expected : expected - req.startAt
      if (drift > BigInt(TRIAL_START_TOLERANCE_SECONDS)) fields.push('startAt')
    }

    if (fields.length > 0) throw mismatch(fields)
  }

  private async trialDaysFor(plan: PlanForTerms, payerAddress: string): Promise<number> {
    const days = plan.trialPeriodDays ?? 0
    if (days <= 0) return 0
    const earlier = await this.prisma.db.subscription.findFirst({
      where: { planId: plan.id, payerAddress },
      select: { id: true },
    })
    return earlier ? 0 : days
  }
}

function normalisePayer(payer: string): string {
  const normalised = payer.trim().toLowerCase()
  if (!/^0x[0-9a-f]{40}$/u.test(normalised)) {
    throw new BadRequestException({ code: 'invalid_request', message: 'payer must be an address' })
  }
  return normalised
}

function unixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000)
}

function mismatch(fields: string[]): BadRequestException {
  return new BadRequestException({
    code: 'enrolment_terms_mismatch',
    message: `enrolment does not match the plan: ${fields.join(', ')}`,
    fields,
  })
}
