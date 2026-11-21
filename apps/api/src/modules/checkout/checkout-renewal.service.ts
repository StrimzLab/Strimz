import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type { SubscriptionStatus } from '@strimz/db'
import { TypedConfigService } from '../../config/index.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { tokenAddressForCurrency } from '../payment-sessions/token-resolver.js'
import { RelayService } from '../relay/relay.service.js'
import type { CheckoutAllowanceRelay } from '../relay/relay.dto.js'
import type { RelaySubmissionView } from '../relay/relay.types.js'

/** Charges a renewal approves; matches the checkout cap for open-ended plans. */
const RENEWAL_CHARGES = 12n
const RENEWABLE: readonly SubscriptionStatus[] = ['trialing', 'active', 'at_risk']

export interface SubscriptionRenewalView {
  subscriptionId: string
  status: SubscriptionStatus
  planName: string
  merchantName: string | null
  amount: string
  currency: 'USDC' | 'EURC'
  token: `0x${string}`
  payerAddress: string
  spender: `0x${string}`
  /** Added to whatever is already approved; the page signs current + this. */
  suggestedAllowance: string
}

@Injectable()
export class CheckoutRenewalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: TypedConfigService,
    private readonly relay: RelayService,
  ) {}

  async details(id: string): Promise<SubscriptionRenewalView> {
    const sub = await this.prisma.db.subscription.findUnique({
      where: { id },
      include: {
        plan: { select: { name: true } },
        merchant: { select: { businessName: true } },
      },
    })
    if (!sub) throw new NotFoundException({ code: 'not_found', message: 'subscription not found' })
    return {
      subscriptionId: sub.id,
      status: sub.status,
      planName: sub.plan.name,
      merchantName: sub.merchant.businessName,
      amount: sub.amount,
      currency: sub.currency,
      token: this.token(sub.currency),
      payerAddress: sub.payerAddress.toLowerCase(),
      spender: this.spender(),
      suggestedAllowance: (BigInt(sub.amount) * RENEWAL_CHARGES).toString(),
    }
  }

  async renew(
    id: string,
    body: CheckoutAllowanceRelay,
    clientIp?: string,
  ): Promise<RelaySubmissionView> {
    const sub = await this.prisma.db.subscription.findUnique({ where: { id } })
    if (!sub) throw new NotFoundException({ code: 'not_found', message: 'subscription not found' })
    if (!RENEWABLE.includes(sub.status)) {
      throw new ConflictException({
        code: 'subscription_not_active',
        message: `a ${sub.status} subscription can't be renewed`,
      })
    }
    if (body.owner.toLowerCase() !== sub.payerAddress.toLowerCase()) {
      throw new ForbiddenException({
        code: 'payer_mismatch',
        message: "this wallet isn't the one that subscribed",
      })
    }
    if (body.value < BigInt(sub.amount)) {
      throw new BadRequestException({
        code: 'invalid_request',
        message: 'the allowance must cover at least one charge',
      })
    }
    return this.relay.submitPermitAllowance({
      token: this.token(sub.currency),
      owner: body.owner as `0x${string}`,
      value: body.value,
      deadline: body.deadline,
      signature: body.signature,
      merchantInternalId: sub.merchantId,
      subscriptionInternalId: sub.id,
      clientIp,
    })
  }

  async merchantOf(id: string): Promise<string> {
    const sub = await this.prisma.db.subscription.findUnique({
      where: { id },
      select: { merchantId: true },
    })
    if (!sub) throw new NotFoundException({ code: 'not_found', message: 'subscription not found' })
    return sub.merchantId
  }

  private token(currency: 'USDC' | 'EURC'): `0x${string}` {
    const token = tokenAddressForCurrency(this.cfg, currency)
    if (!token) throw new Error(`no token address configured for ${currency}`)
    return token
  }

  private spender(): `0x${string}` {
    const address = this.cfg.env.STRIMZ_SUBSCRIPTIONS_ADDRESS
    if (!address) throw new Error('STRIMZ_SUBSCRIPTIONS_ADDRESS is not configured')
    return address.toLowerCase() as `0x${string}`
  }
}
