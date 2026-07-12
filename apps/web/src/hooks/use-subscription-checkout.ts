'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAccount, useChainId, useSignTypedData } from 'wagmi'
import { buildPermitTypedData, buildSubscriptionIntentTypedData } from '@strimz/sdk/eip712'
import type { TokenMetadata } from '@strimz/shared-types'

import { env } from '@/lib/env'
import { strimzBrowserClient } from '@/lib/strimz-browser'
import type { RelaySubmissionView } from '@/lib/strimz-bff'

/**
 * Subscription enrolment flow on the hosted checkout.
 *
 * Mirrors `usePayCheckout` but for the EIP-2612 path:
 *  1. Read the payer's current EIP-2612 nonce for the token.
 *  2. Build the `Permit` typed-data with the StrimzSubscriptions
 *     contract as `spender`.
 *  3. Ask the wallet to sign (wagmi `signTypedData`).
 *  4. POST `kind: 'subscription'` to the BFF.
 *  5. Poll the relay submission until terminal status.
 *
 * Same `phase` surface as `usePayCheckout` so the subscription page
 * can reuse the page-level VisiblePhase mapping verbatim. Future
 * refactor opportunity: extract the polling helpers into a shared
 * module once a third meta-tx path appears (e.g. x402 nanopayments).
 */

export interface SubscriptionCheckoutInputs {
  /** Hosted checkout session id (used as both the BFF path arg and
   *  the BullMQ idempotency key. So resubmitting the same session
   *  never creates a duplicate on-chain subscription). */
  sessionId: string
  /** On-chain registry merchant id. From the session payload. For
   *  now hardcoded by the demo page until #68 lands. */
  merchantId: bigint
  /** Token metadata loaded from `/v1/tokens/:address`. */
  tokenMeta: TokenMetadata
  /** Per-period charge amount in token base units. */
  amount: bigint
  /** Seconds between charges (uint32). */
  intervalSeconds: number
  /** Unix seconds of the first charge; 0 = "now". */
  startAt?: bigint
  /** Unix seconds after which the schedule stops; 0 = open-ended. */
  endAt?: bigint
  /** Allowance value to grant via permit. Defaults to type(uint256).max,
   *  the standard "unlimited allowance" pattern for recurring payments.
   *  Future charges are constrained by the per-period `amount`, not the
   *  allowance itself. */
  permitValue?: bigint
  /** Seconds the permit signature is valid for. Default 24h. Long
   *  enough to absorb a slow merchant submit pipeline, short enough
   *  that a leaked signature doesn't authorise an indefinite
   *  enrolment window. */
  permitValidForSeconds?: number
}

export type SubscriptionPhase =
  | 'idle'
  | 'signing'
  | 'submitting'
  | 'polling'
  | 'confirmed'
  | 'reverted'
  | 'failed'

export interface SubscriptionCheckoutState {
  phase: SubscriptionPhase
  error: string | null
  txHash: string | null
  submission: RelaySubmissionView | null
}

interface UseSubscriptionCheckoutResult extends SubscriptionCheckoutState {
  submit: () => Promise<void>
}

const POLL_INTERVAL_MS = 1500
const POLL_TIMEOUT_MS = 120_000
const UINT256_MAX = (1n << 256n) - 1n

export function useSubscriptionCheckout(
  inputs: SubscriptionCheckoutInputs,
): UseSubscriptionCheckoutResult {
  const {
    sessionId,
    merchantId,
    tokenMeta,
    amount,
    intervalSeconds,
    startAt = 0n,
    endAt = 0n,
  } = inputs
  const permitValue = inputs.permitValue ?? UINT256_MAX
  const permitValidForSeconds = inputs.permitValidForSeconds ?? 24 * 60 * 60

  const { address } = useAccount()
  const chainId = useChainId()
  const { signTypedDataAsync } = useSignTypedData()

  const [state, setState] = useState<SubscriptionCheckoutState>({
    phase: 'idle',
    error: null,
    txHash: null,
    submission: null,
  })

  const inFlightRef = useRef(false)

  const submit = useCallback(async () => {
    if (inFlightRef.current) return
    if (!address) {
      setState((s) => ({ ...s, phase: 'failed', error: 'wallet not connected' }))
      return
    }
    if (!env.subscriptionsAddress) {
      setState((s) => ({
        ...s,
        phase: 'failed',
        error: 'NEXT_PUBLIC_STRIMZ_SUBSCRIPTIONS_ADDRESS is not configured',
      }))
      return
    }
    if (!tokenMeta.capabilities.permit2612) {
      setState((s) => ({
        ...s,
        phase: 'failed',
        error: `${tokenMeta.symbol} does not support EIP-2612. Fall back to approve+create flow.`,
      }))
      return
    }

    inFlightRef.current = true
    setState({ phase: 'signing', error: null, txHash: null, submission: null })

    try {
      const tokenAddress = tokenMeta.address as `0x${string}`

      // Read the payer's current permit nonce immediately before
      // signing. The token contract rejects stale nonces, so racing
      // with another permit on the same owner just fails predictably.
      const nonceResp = await strimzBrowserClient().tokens.permitNonce(tokenAddress, address)
      const permitNonce = BigInt(nonceResp.nonce)

      const now = Math.floor(Date.now() / 1000)
      const deadline = BigInt(now + permitValidForSeconds)

      const permitTypedData = buildPermitTypedData({
        chainId,
        token: tokenAddress,
        tokenName: tokenMeta.name,
        tokenVersion: tokenMeta.version,
        owner: address,
        spender: env.subscriptionsAddress as `0x${string}`,
        value: permitValue,
        nonce: permitNonce,
        deadline,
      })

      const permitSigHex = (await signTypedDataAsync(
        permitTypedData as Parameters<typeof signTypedDataAsync>[0],
      )) as `0x${string}`
      const permitSig = splitSignature(permitSigHex)

      // Second signature: SubscriptionIntent. Blocks enrolment in a
      // plan the payer never picked.
      const intentTypedData = buildSubscriptionIntentTypedData({
        chainId,
        verifyingContract: env.subscriptionsAddress as `0x${string}`,
        merchantId,
        token: tokenAddress,
        amount,
        interval: intervalSeconds,
        startAt,
        endAt,
        permitDeadline: deadline,
      })
      const intentSigHex = (await signTypedDataAsync(
        intentTypedData as Parameters<typeof signTypedDataAsync>[0],
      )) as `0x${string}`
      const intentSig = splitSignature(intentSigHex)

      setState((prev) => ({ ...prev, phase: 'submitting' }))

      // sessionId here is the shared planId, so scope the relay dedupe key by
      // payer — otherwise a second wallet on the same plan collides with the
      // first and gets silently dropped.
      const idempotencyKey = `${sessionId}:${address.toLowerCase()}`

      const submission = await postSubmit(sessionId, {
        kind: 'subscription',
        idempotencyKey,
        merchantId: merchantId.toString(),
        token: tokenAddress,
        amount: amount.toString(),
        interval: intervalSeconds,
        startAt: startAt.toString(),
        endAt: endAt.toString(),
        permitData: {
          owner: address,
          value: permitValue.toString(),
          deadline: deadline.toString(),
        },
        permitSignature: { v: permitSig.v, r: permitSig.r, s: permitSig.s },
        intentSignature: { v: intentSig.v, r: intentSig.r, s: intentSig.s },
      })

      setState({ phase: 'polling', error: null, txHash: null, submission })
      await pollUntilTerminal(sessionId, idempotencyKey, (next) => {
        setState((prev) => ({ ...prev, submission: next, txHash: next.txHash }))
        return mapTerminalPhase(next.status)
      }).then((terminal) => {
        setState((prev) => ({ ...prev, phase: terminal }))
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error'
      setState((prev) => ({ ...prev, phase: 'failed', error: message }))
    } finally {
      inFlightRef.current = false
    }
  }, [
    address,
    chainId,
    sessionId,
    merchantId,
    tokenMeta,
    amount,
    intervalSeconds,
    startAt,
    endAt,
    permitValue,
    permitValidForSeconds,
    signTypedDataAsync,
  ])

  useEffect(() => {
    setState({ phase: 'idle', error: null, txHash: null, submission: null })
  }, [sessionId])

  return { ...state, submit }
}

// ---- helpers (intentionally duplicated from use-pay-checkout. See
// note on extraction at the top of this file) ----

function splitSignature(sigHex: `0x${string}`): {
  r: `0x${string}`
  s: `0x${string}`
  v: number
} {
  if (sigHex.length !== 132) {
    throw new Error(`expected 65-byte signature hex, got ${sigHex.length} chars`)
  }
  const r = `0x${sigHex.slice(2, 66)}` as `0x${string}`
  const s = `0x${sigHex.slice(66, 130)}` as `0x${string}`
  const vRaw = parseInt(sigHex.slice(130, 132), 16)
  const v = vRaw < 27 ? vRaw + 27 : vRaw
  return { r, s, v }
}

interface SubmitBody {
  kind: 'subscription'
  idempotencyKey: string
  merchantId: string
  token: `0x${string}`
  amount: string
  interval: number
  startAt: string
  endAt: string
  permitData: { owner: `0x${string}`; value: string; deadline: string }
  permitSignature: { v: number; r: `0x${string}`; s: `0x${string}` }
  intentSignature: { v: number; r: `0x${string}`; s: `0x${string}` }
}

async function postSubmit(sessionId: string, body: SubmitBody): Promise<RelaySubmissionView> {
  const res = await fetch(`/api/checkout/sessions/${encodeURIComponent(sessionId)}/submit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ message: `submit failed (${res.status})` }))
    throw new Error(detail.message ?? `submit failed (${res.status})`)
  }
  return (await res.json()) as RelaySubmissionView
}

async function pollUntilTerminal(
  sessionId: string,
  idempotencyKey: string,
  onUpdate: (view: RelaySubmissionView) => SubscriptionPhase | null,
): Promise<SubscriptionPhase> {
  const start = Date.now()
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const res = await fetch(
      `/api/checkout/sessions/${encodeURIComponent(sessionId)}/submissions/${encodeURIComponent(idempotencyKey)}`,
      { cache: 'no-store' },
    )
    if (res.ok) {
      const view = (await res.json()) as RelaySubmissionView
      const terminal = onUpdate(view)
      if (terminal) return terminal
    } else if (isFatalPollStatus(res.status)) {
      // A permission or bad-request failure never clears on retry.
      // Surface the upstream message now instead of spinning out the
      // full timeout and reporting a useless "poll timed out".
      throw new Error(await pollErrorMessage(res))
    }
    // 404 (record not visible yet) and 5xx / network blips fall through
    // and get retried until the timeout.
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
  throw new Error('submission status poll timed out')
}

// 401/403 = the checkout BFF's internal key can't read submissions;
// 400 = a malformed request. None of these resolve by waiting.
function isFatalPollStatus(status: number): boolean {
  return status === 400 || status === 401 || status === 403
}

async function pollErrorMessage(res: Response): Promise<string> {
  const fallback = `submission status check failed (${res.status})`
  try {
    const body = (await res.json()) as {
      message?: string
      detail?: { message?: string; error?: { message?: string } }
    }
    return body.detail?.error?.message ?? body.detail?.message ?? body.message ?? fallback
  } catch {
    return fallback
  }
}

function mapTerminalPhase(status: RelaySubmissionView['status']): SubscriptionPhase | null {
  switch (status) {
    case 'confirmed':
      return 'confirmed'
    case 'reverted':
      return 'reverted'
    case 'failed':
      return 'failed'
    case 'queued':
    case 'signing':
    case 'broadcast':
    default:
      return null
  }
}
