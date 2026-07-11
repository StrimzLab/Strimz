'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAccount, useChainId, useSignTypedData } from 'wagmi'
import { buildPayIntentTypedData, buildReceiveWithAuthorizationTypedData } from '@strimz/sdk/eip712'
import type { TokenMetadata } from '@strimz/shared-types'
import { stringToHex } from 'viem'

import { env } from '@/lib/env'
import type { RelaySubmissionView } from '@/lib/strimz-bff'

/**
 * One-shot payment flow on the hosted checkout.
 *
 * Collapses the legacy approve+pay into ONE payer interaction:
 *  1. Build EIP-3009 `ReceiveWithAuthorization` typed-data
 *     (StrimzPayments is the `to`; nonce is random).
 *  2. Ask the wallet to sign it (wagmi `signTypedData`).
 *  3. POST the signature to `/api/checkout/sessions/:id/submit`.
 *  4. Poll `/api/checkout/sessions/:id/submissions/:key` until the
 *     submission reaches a terminal status.
 *
 * State surfaces three things the page consumes:
 *  - `phase`: idle | signing | submitting | polling | confirmed | reverted | failed
 *  - `error`: string | null
 *  - `txHash`: string | null (set once the submission confirms)
 *
 * The hook intentionally doesn't manage wallet connection. That's
 * the page's job via Reown AppKit. The hook expects `from` (the
 * payer) to be set by the time `submit()` is called.
 */

export interface PayCheckoutInputs {
  sessionId: string
  /** On-chain registry merchant id; from the session. */
  merchantId: bigint
  /** USDC (or other meta-tx-capable token) the merchant requested. */
  tokenMeta: TokenMetadata
  /** Gross amount in token base units (e.g. 50.00 USDC = 50_000_000n). */
  amount: bigint
  /** Off-chain reference. Defaults to the PaymentSession id encoded as raw
   *  ASCII bytes padded to bytes32. The form the indexer reverses to
   *  reconnect the on-chain Transaction back to its session row. */
  ref?: `0x${string}`
  /** Signature validity window in seconds. Default 5 minutes. Matches the
   *  whitepaper's signed window for one-shot payments. */
  validForSeconds?: number
}

export type PayPhase =
  | 'idle'
  | 'signing'
  | 'submitting'
  | 'polling'
  | 'confirmed'
  | 'reverted'
  | 'failed'

export interface PayCheckoutState {
  phase: PayPhase
  error: string | null
  txHash: string | null
  submission: RelaySubmissionView | null
}

interface UsePayCheckoutResult extends PayCheckoutState {
  submit: () => Promise<void>
}

const POLL_INTERVAL_MS = 1500
const POLL_TIMEOUT_MS = 120_000

export function usePayCheckout(inputs: PayCheckoutInputs): UsePayCheckoutResult {
  const { sessionId, merchantId, tokenMeta, amount } = inputs
  const validForSeconds = inputs.validForSeconds ?? 5 * 60

  const { address } = useAccount()
  const chainId = useChainId()
  const { signTypedDataAsync } = useSignTypedData()

  const [state, setState] = useState<PayCheckoutState>({
    phase: 'idle',
    error: null,
    txHash: null,
    submission: null,
  })

  // Guards against double-submit when React StrictMode double-fires
  // effects, or when the user clicks the button twice quickly.
  const inFlightRef = useRef(false)

  const submit = useCallback(async () => {
    if (inFlightRef.current) return
    if (!address) {
      setState((s) => ({ ...s, phase: 'failed', error: 'wallet not connected' }))
      return
    }
    if (!env.paymentsAddress) {
      setState((s) => ({
        ...s,
        phase: 'failed',
        error: 'NEXT_PUBLIC_STRIMZ_PAYMENTS_ADDRESS is not configured',
      }))
      return
    }
    if (!tokenMeta.capabilities.transferAuth3009) {
      setState((s) => ({
        ...s,
        phase: 'failed',
        error: `${tokenMeta.symbol} does not support EIP-3009. Fall back to approve+pay flow.`,
      }))
      return
    }

    inFlightRef.current = true
    setState({ phase: 'signing', error: null, txHash: null, submission: null })

    try {
      const now = Math.floor(Date.now() / 1000)
      const validAfter = BigInt(Math.max(0, now - 60)) // 60s clock-skew tolerance
      const validBefore = BigInt(now + validForSeconds)
      const nonce = randomBytes32()
      // The on-chain `bytes32 ref` carries the PaymentSession id as raw
      // ASCII bytes, right-padded with NULL to 32 bytes. The indexer
      // decodes the same shape and links the resulting Transaction back
      // to its session. CUIDs are ≤ 32 printable ASCII chars so this
      // fits without truncation.
      const ref = inputs.ref ?? stringToHex(sessionId, { size: 32 })

      // `tokenMeta.address` is validated server-side as a 0x-prefixed
      // 20-byte hex (TokensService normalises to lower-case before
      // returning), but the shared-types schema models it as `string`.
      // The cast is safe given that validation.
      const tokenAddress = tokenMeta.address as `0x${string}`

      const authTypedData = buildReceiveWithAuthorizationTypedData({
        chainId,
        token: tokenAddress,
        tokenName: tokenMeta.name,
        tokenVersion: tokenMeta.version,
        from: address,
        to: env.paymentsAddress as `0x${string}`,
        value: amount,
        validAfter,
        validBefore,
        nonce,
      })

      const authSigHex = (await signTypedDataAsync(
        authTypedData as Parameters<typeof signTypedDataAsync>[0],
      )) as `0x${string}`
      const authSig = splitSignature(authSigHex)

      // Second sig: PayIntent. Blocks a redirect to a different
      // merchant if the auth sig leaks.
      const intentTypedData = buildPayIntentTypedData({
        chainId,
        verifyingContract: env.paymentsAddress as `0x${string}`,
        merchantId,
        token: tokenAddress,
        amount,
        nonce,
        validBefore,
        ref,
      })
      const intentSigHex = (await signTypedDataAsync(
        intentTypedData as Parameters<typeof signTypedDataAsync>[0],
      )) as `0x${string}`
      const intentSig = splitSignature(intentSigHex)

      setState((prev) => ({ ...prev, phase: 'submitting' }))

      const submission = await postSubmit(sessionId, {
        kind: 'payment',
        idempotencyKey: sessionId,
        merchantId: merchantId.toString(),
        token: tokenAddress,
        auth: {
          from: address,
          amount: amount.toString(),
          validAfter: validAfter.toString(),
          validBefore: validBefore.toString(),
          nonce,
        },
        ref,
        authSignature: { v: authSig.v, r: authSig.r, s: authSig.s },
        intentSignature: { v: intentSig.v, r: intentSig.r, s: intentSig.s },
      })

      setState({ phase: 'polling', error: null, txHash: null, submission })
      await pollUntilTerminal(sessionId, sessionId, (next) => {
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
    validForSeconds,
    inputs.ref,
    signTypedDataAsync,
  ])

  // Reset when the bound session changes (e.g. user navigates to a
  // different checkout) so we don't reuse stale state.
  useEffect(() => {
    setState({ phase: 'idle', error: null, txHash: null, submission: null })
  }, [sessionId])

  return { ...state, submit }
}

// ---- helpers (intentionally local. These are coupling glue, not a
// generic utility surface) ----

function randomBytes32(): `0x${string}` {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}` as `0x${string}`
}

function splitSignature(sigHex: `0x${string}`): { r: `0x${string}`; s: `0x${string}`; v: number } {
  if (sigHex.length !== 132) {
    throw new Error(`expected 65-byte signature hex, got ${sigHex.length} chars`)
  }
  const r = `0x${sigHex.slice(2, 66)}` as `0x${string}`
  const s = `0x${sigHex.slice(66, 130)}` as `0x${string}`
  const vRaw = parseInt(sigHex.slice(130, 132), 16)
  // Some wallets return `v` as 0/1 (yParity) instead of 27/28. Normalise.
  const v = vRaw < 27 ? vRaw + 27 : vRaw
  return { r, s, v }
}

interface SubmitBody {
  kind: 'payment'
  idempotencyKey: string
  merchantId: string
  token: `0x${string}`
  auth: {
    from: `0x${string}`
    amount: string
    validAfter: string
    validBefore: string
    nonce: `0x${string}`
  }
  ref: `0x${string}`
  authSignature: { v: number; r: `0x${string}`; s: `0x${string}` }
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
  onUpdate: (view: RelaySubmissionView) => PayPhase | null,
): Promise<PayPhase> {
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
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
  throw new Error('submission status poll timed out')
}

function mapTerminalPhase(status: RelaySubmissionView['status']): PayPhase | null {
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
