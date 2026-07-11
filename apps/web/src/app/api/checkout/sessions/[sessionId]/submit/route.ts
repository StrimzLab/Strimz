import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { bffSubmitPayment, bffSubmitSubscription } from '@/lib/strimz-bff'

/**
 * Checkout BFF. Accepts a payer-signed EIP-3009 or EIP-2612 payload
 * from the hosted checkout page and forwards it to Strimz's relay
 * endpoints with the server-only internal API key.
 *
 * Why a BFF: the Strimz relay endpoints require `relay_write`, a
 * scope only available to secret API keys. We never put a secret key
 * in the browser, so the browser POSTs here (same-origin, no auth
 * header) and this handler attaches the server-only credential.
 *
 * Trust model: the request body carries the payer's signature, which
 * the on-chain contract validates via ecrecover. The session id in
 * the path acts as a soft binding for operator diagnostics (the relay
 * service stores it under `sessionId`). It is NOT what authorises
 * the submission. Anyone who has the signature can submit it; the
 * permissionless meta-tx model is already designed for that.
 *
 * Body discriminator: `kind: "payment" | "subscription"` chooses the
 * downstream relay endpoint. Keeping both behind one route avoids the
 * client having to know which path it's on (it already picked via
 * `selectPaymentPath` / `selectSubscriptionPath` in the SDK).
 */

const vrsSchema = z.object({
  v: z.number().int(),
  r: z.string().regex(/^0x[0-9a-fA-F]{64}$/u),
  s: z.string().regex(/^0x[0-9a-fA-F]{64}$/u),
})

const bigintStringSchema = z.string().regex(/^[0-9]+$/u)
const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/u)
const bytes32Schema = z.string().regex(/^0x[0-9a-fA-F]{64}$/u)

const paymentBodySchema = z.object({
  kind: z.literal('payment'),
  idempotencyKey: z.string().min(1).max(128),
  merchantId: bigintStringSchema,
  token: addressSchema,
  auth: z.object({
    from: addressSchema,
    amount: bigintStringSchema,
    validAfter: bigintStringSchema,
    validBefore: bigintStringSchema,
    nonce: bytes32Schema,
  }),
  ref: bytes32Schema,
  authSignature: vrsSchema,
  intentSignature: vrsSchema,
})

const subscriptionBodySchema = z.object({
  kind: z.literal('subscription'),
  idempotencyKey: z.string().min(1).max(128),
  merchantId: bigintStringSchema,
  token: addressSchema,
  amount: bigintStringSchema,
  interval: z.number().int().positive(),
  startAt: bigintStringSchema,
  endAt: bigintStringSchema,
  permitData: z.object({
    owner: addressSchema,
    value: bigintStringSchema,
    deadline: bigintStringSchema,
  }),
  permitSignature: vrsSchema,
  intentSignature: vrsSchema,
})

const bodySchema = z.discriminatedUnion('kind', [paymentBodySchema, subscriptionBodySchema])

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<NextResponse> {
  const { sessionId } = await params

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return badRequest('invalid_json', 'request body is not valid JSON')
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return badRequest('invalid_body', parsed.error.issues.map((i) => i.message).join('; '))
  }

  try {
    if (parsed.data.kind === 'payment') {
      const { kind: _kind, ...body } = parsed.data
      const view = await bffSubmitPayment({
        ...body,
        token: body.token as `0x${string}`,
        auth: {
          ...body.auth,
          from: body.auth.from as `0x${string}`,
          nonce: body.auth.nonce as `0x${string}`,
        },
        ref: body.ref as `0x${string}`,
        authSignature: {
          v: body.authSignature.v,
          r: body.authSignature.r as `0x${string}`,
          s: body.authSignature.s as `0x${string}`,
        },
        intentSignature: {
          v: body.intentSignature.v,
          r: body.intentSignature.r as `0x${string}`,
          s: body.intentSignature.s as `0x${string}`,
        },
        sessionId,
      })
      return NextResponse.json(view)
    }
    const { kind: _kind, ...body } = parsed.data
    const view = await bffSubmitSubscription({
      ...body,
      token: body.token as `0x${string}`,
      permitData: {
        owner: body.permitData.owner as `0x${string}`,
        value: body.permitData.value,
        deadline: body.permitData.deadline,
      },
      permitSignature: {
        v: body.permitSignature.v,
        r: body.permitSignature.r as `0x${string}`,
        s: body.permitSignature.s as `0x${string}`,
      },
      intentSignature: {
        v: body.intentSignature.v,
        r: body.intentSignature.r as `0x${string}`,
        s: body.intentSignature.s as `0x${string}`,
      },
      subscriptionInternalId: sessionId,
    })
    return NextResponse.json(view)
  } catch (err) {
    const e = err as Error & { status?: number; detail?: unknown }
    return NextResponse.json(
      { code: 'relay_submission_failed', message: e.message, detail: e.detail },
      { status: e.status ?? 502 },
    )
  }
}

function badRequest(code: string, message: string): NextResponse {
  return NextResponse.json({ code, message }, { status: 400 })
}
