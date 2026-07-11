import { NextResponse, type NextRequest } from 'next/server'

import { bffGetSubmission } from '@/lib/strimz-bff'

/**
 * Polling endpoint for the hosted checkout. The browser hits this on
 * a short interval after submitting until `status` reaches a terminal
 * value (`confirmed`, `reverted`, or `failed`).
 *
 * Same trust model as the submit handler. The idempotency key is
 * opaque enough to function as a soft handle, and a leaked key only
 * reveals that a submission with that key was made (no funds, no
 * signature material).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; idempotencyKey: string }> },
): Promise<NextResponse> {
  const { idempotencyKey } = await params
  try {
    const view = await bffGetSubmission(idempotencyKey)
    if (!view) {
      return NextResponse.json(
        { code: 'submission_not_found', message: 'no relay submission for this key' },
        { status: 404 },
      )
    }
    return NextResponse.json(view)
  } catch (err) {
    const e = err as Error & { status?: number; detail?: unknown }
    return NextResponse.json(
      { code: 'relay_lookup_failed', message: e.message, detail: e.detail },
      { status: e.status ?? 502 },
    )
  }
}
