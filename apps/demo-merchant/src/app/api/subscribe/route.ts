import { NextResponse } from 'next/server'
import { getStrimzServerClient } from '@/lib/strimz-server'
import { dollarsToUsdcBaseUnits } from '@/lib/format'

/**
 * POST /api/subscribe
 *
 * Creates (or reuses) a Fanline Pro subscription plan on Strimz and
 * returns the hosted-checkout URL for it. Because a Strimz merchant's
 * plans persist across sessions, we don't want to mint a fresh plan on
 * every button click — the first call creates it, later calls
 * `list()` first and reuse the existing one by handle.
 *
 * The demo plan is $9.99/month, USDC, monthly interval.
 */

const PLAN_HANDLE = 'fanline-pro-monthly'

async function findOrCreatePlan() {
  const strimz = getStrimzServerClient()

  const existing = await strimz.subscriptionPlans.list({ limit: 100 })
  const found = existing.data.find(
    (p) =>
      p.metadata &&
      typeof p.metadata === 'object' &&
      (p.metadata as Record<string, unknown>).handle === PLAN_HANDLE,
  )
  if (found) return found

  return strimz.subscriptionPlans.create({
    name: 'Fanline Pro',
    description: 'Ad-free, unlimited streams, early access, VIP DMs.',
    currency: 'USDC',
    amount: dollarsToUsdcBaseUnits('9.99'),
    interval: 'monthly',
    intervalCount: 1,
    metadata: {
      handle: PLAN_HANDLE,
      source: 'fanline_demo',
    },
  })
}

export async function POST(_req: Request) {
  const checkoutOrigin = process.env.NEXT_PUBLIC_STRIMZ_CHECKOUT_ORIGIN || 'http://localhost:3000'

  try {
    const plan = await findOrCreatePlan()
    // Strimz hosted checkout renders a plan-scoped subscribe page at
    // /sub/{planId}. The plan URL is the entry point a merchant would
    // hand to their subscription CTA.
    const checkoutUrl = `${checkoutOrigin}/sub/${plan.id}`
    return NextResponse.json({
      planId: plan.id,
      planName: plan.name,
      checkoutUrl,
    })
  } catch (err) {
    console.error('[fanline] subscription plan setup failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'plan setup failed' },
      { status: 500 },
    )
  }
}
