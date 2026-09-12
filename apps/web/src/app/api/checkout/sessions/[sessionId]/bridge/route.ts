import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { bffGetBridge, bffSubmitBridge } from '@/lib/strimz-bff'

/**
 * Cross-chain funding for the hosted checkout, same BFF rationale as
 * the submit handler — the relay endpoints need a secret key that
 * never belongs in the browser.
 *
 * GET  asks whether this session can be funded and what has already
 *      happened. The checkout calls it twice: before the payer burns
 *      anything, and on page load so a payer who closed the tab
 *      mid-bridge resumes instead of burning a second time.
 * POST records the burn hash and starts the attestation poll.
 *
 * The split is deliberate. Everything that can refuse a payer lives
 * in GET, which costs nothing to call. By the time POST runs the
 * payer has spent real money, and there is no good answer to "your
 * burn was fine but your session wasn't".
 */

const bodySchema = z.object({
  sourceChain: z.enum([
    'ethereum',
    'base',
    'polygon',
    'arbitrum',
    'optimism',
    'avalanche',
    'solana',
  ]),
  burnTxHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/u),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<NextResponse> {
  const { sessionId } = await params
  try {
    return NextResponse.json(await bffGetBridge(sessionId))
  } catch (err) {
    return upstreamError(err, 'bridge_lookup_failed')
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<NextResponse> {
  const { sessionId } = await params

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json(
      { code: 'invalid_json', message: 'request body is not valid JSON' },
      { status: 400 },
    )
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      {
        code: 'invalid_body',
        message: parsed.error.issues.map((i) => i.message).join('; '),
      },
      { status: 400 },
    )
  }

  try {
    const view = await bffSubmitBridge({
      sessionId,
      sourceChain: parsed.data.sourceChain,
      burnTxHash: parsed.data.burnTxHash as `0x${string}`,
    })
    return NextResponse.json(view)
  } catch (err) {
    return upstreamError(err, 'bridge_submit_failed')
  }
}

function upstreamError(err: unknown, code: string): NextResponse {
  const e = err as Error & { status?: number; detail?: unknown }
  return NextResponse.json(
    { code, message: e.message, detail: e.detail },
    { status: e.status ?? 502 },
  )
}
