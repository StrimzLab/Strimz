import { ForbiddenException } from '@nestjs/common'
import type { PrismaService } from '../../infra/prisma/prisma.service.js'
import {
  PLANS,
  lowestPlanWith,
  planIncludes,
  type MerchantTier,
  type PlanFeature,
} from '@strimz/shared-config'

const FEATURE_NAMES: Record<PlanFeature, string> = {
  storefront: 'the storefront builder',
  anomaly_alerts: 'anomaly alerts',
  yield_recommendations: 'yield recommendations',
}

export function assertPlanIncludes(plan: MerchantTier, feature: PlanFeature): void {
  if (planIncludes(plan, feature)) return
  const requiredPlan = lowestPlanWith(feature)
  const required = PLANS[requiredPlan]
  throw new ForbiddenException({
    code: 'plan_required',
    message: `${FEATURE_NAMES[feature]} needs the ${required.name} plan, which starts automatically once ${required.entersAtVolume?.toLocaleString('en-US')} USDC or EURC has been processed`,
    details: { feature, plan, requiredPlan },
  })
}

export async function requirePlanFeature(
  prisma: PrismaService,
  merchantId: string,
  feature: PlanFeature,
): Promise<void> {
  const { tier } = await prisma.db.merchant.findUniqueOrThrow({
    where: { id: merchantId },
    select: { tier: true },
  })
  assertPlanIncludes(tier, feature)
}
