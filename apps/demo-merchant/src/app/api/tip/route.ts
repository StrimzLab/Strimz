import { NextResponse } from 'next/server'
import { getStrimzServerClient } from '@/lib/strimz-server'
import { dollarsToUsdcBaseUnits } from '@/lib/format'

/**
 * POST /api/tip
 *
 * Creates a Strimz one-shot payment session for a fan tip and returns
 * the hosted-checkout URL. This is the exact code path a real merchant
 * running Fanline would ship in production — same secret key, same
 * SDK, same session lifecycle. The demo has no auth on top of it
 * because the whole app is one merchant; a real Fanline would gate
 * this behind the creator's session.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { amountDollars, creatorHandle } = body as {
    amountDollars?: string
    creatorHandle?: string
  }

  if (!amountDollars) {
    return NextResponse.json({ error: 'amountDollars is required' }, { status: 400 })
  }

  let amount: string
  try {
    amount = dollarsToUsdcBaseUnits(amountDollars)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'invalid amount' },
      { status: 400 },
    )
  }

  const strimz = getStrimzServerClient()
  const fanline = process.env.NEXT_PUBLIC_FANLINE_URL || 'http://localhost:3200'

  try {
    const session = await strimz.paymentSessions.create({
      currency: 'USDC',
      amount,
      // 30 minutes is Strimz's checkout SLA. Long enough that the payer
      // can dig their wallet out, short enough that a stale session
      // doesn't linger.
      expiresInMinutes: 30,
      description: `Fanline tip for @${creatorHandle ?? 'creator'}`,
      successUrl: `${fanline}/thanks?type=tip&amount=${amountDollars}`,
      cancelUrl: `${fanline}/cancelled?type=tip`,
      metadata: {
        source: 'fanline_demo',
        flow: 'tip',
        creatorHandle: creatorHandle ?? 'creator',
      },
    })

    return NextResponse.json({
      sessionId: session.id,
      checkoutUrl: session.checkoutUrl,
      amountDollars,
    })
  } catch (err) {
    console.error('[fanline] tip session creation failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'session creation failed' },
      { status: 500 },
    )
  }
}
