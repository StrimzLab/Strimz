import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type { SubscriptionStatus } from '@strimz/db'
import { VIEW_SUBSCRIPTIONS_VALIDITY_SECONDS } from '@strimz/sdk/eip712'

import { TypedConfigService } from '../../config/index.js'
import { ChainService } from '../../infra/chain/chain.service.js'
import { PrismaService } from '../../infra/prisma/prisma.service.js'
import { RelayChainProbe } from '../relay/relay-chain-probe.js'
import type { ManageSubscriptionCancel, ManageSubscriptionsList } from '../relay/relay.dto.js'
import { RelayService } from '../relay/relay.service.js'
import type { RelaySubmissionView } from '../relay/relay.types.js'

const OPEN: readonly SubscriptionStatus[] = ['trialing', 'active', 'at_risk']
// A wallet clock a little ahead of ours shouldn't lock the subscriber out.
const CLOCK_SKEW_SECONDS = 60n

export interface ManagedSubscription {
  subscriptionId: string
  onchainSubscriptionId: number
  merchantName: string | null
  planName: string
  amount: string
  currency: 'USDC' | 'EURC'
  status: SubscriptionStatus
  nextChargeAt: string | null
  currentPeriodEndAt: string
}

export interface ManagedSubscriptionsView {
  chainId: number
  subscriptionsAddress: `0x${string}`
  data: ManagedSubscription[]
}

@Injectable()
export class CheckoutManageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: TypedConfigService,
    private readonly chain: ChainService,
    private readonly probe: RelayChainProbe,
    private readonly relay: RelayService,
  ) {}

  async list(body: ManageSubscriptionsList, now = new Date()): Promise<ManagedSubscriptionsView> {
    const nowSec = BigInt(Math.floor(now.getTime() / 1000))
    const age = nowSec - body.issuedAt
    if (age > BigInt(VIEW_SUBSCRIPTIONS_VALIDITY_SECONDS) || age < -CLOCK_SKEW_SECONDS) {
      throw new BadRequestException({
        code: 'signature_expired',
        message: 'this sign-in has expired; sign again to see your subscriptions',
      })
    }
    const payer = body.payer.toLowerCase() as `0x${string}`
    const valid = await this.probe.verifyViewSubscriptions({
      payer,
      issuedAt: body.issuedAt,
      signature: body.signature,
    })
    if (!valid) {
      throw new BadRequestException({
        code: 'invalid_signature',
        message: "the signature doesn't match this wallet",
      })
    }

    const rows = await this.prisma.db.subscription.findMany({
      where: {
        payerAddress: { equals: payer, mode: 'insensitive' },
        status: { in: [...OPEN] },
        mode: this.chain.environment === 'mainnet' ? 'live' : 'test',
        onchainSubscriptionId: { not: null },
      },
      include: {
        plan: { select: { name: true } },
        merchant: { select: { businessName: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return {
      chainId: this.chainId(),
      subscriptionsAddress: this.subscriptionsAddress(),
      data: rows.map((sub) => ({
        subscriptionId: sub.id,
        onchainSubscriptionId: sub.onchainSubscriptionId as number,
        merchantName: sub.merchant.businessName,
        planName: sub.plan.name,
        amount: sub.amount,
        currency: sub.currency,
        status: sub.status,
        nextChargeAt: sub.nextChargeAt?.toISOString() ?? null,
        currentPeriodEndAt: sub.currentPeriodEndAt.toISOString(),
      })),
    }
  }

  async cancel(id: string, body: ManageSubscriptionCancel): Promise<RelaySubmissionView> {
    const sub = await this.prisma.db.subscription.findUnique({ where: { id } })
    if (!sub || sub.onchainSubscriptionId === null) {
      throw new NotFoundException({ code: 'not_found', message: 'subscription not found' })
    }
    if (!OPEN.includes(sub.status)) {
      throw new ConflictException({
        code: 'subscription_not_active',
        message: `this subscription is already ${sub.status}`,
      })
    }
    return this.relay.submitCancelWithSig({
      onchainSubscriptionId: BigInt(sub.onchainSubscriptionId),
      payer: sub.payerAddress.toLowerCase() as `0x${string}`,
      deadline: body.deadline,
      signature: body.signature,
      merchantInternalId: sub.merchantId,
      subscriptionInternalId: sub.id,
    })
  }

  private chainId(): number {
    const id = this.chain.client.chain?.id
    if (id === undefined) throw new Error('the Arc client has no chain configured')
    return id
  }

  private subscriptionsAddress(): `0x${string}` {
    const address = this.cfg.env.STRIMZ_SUBSCRIPTIONS_ADDRESS
    if (!address) throw new Error('STRIMZ_SUBSCRIPTIONS_ADDRESS is not configured')
    return address.toLowerCase() as `0x${string}`
  }
}
