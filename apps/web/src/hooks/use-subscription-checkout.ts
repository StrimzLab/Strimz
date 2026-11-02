'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getAccount, getBytecode } from '@wagmi/core'
import { useAccount, useConfig, useSignTypedData, useSwitchChain } from 'wagmi'
import type { TokenMetadata } from '@strimz/shared-types'

import {
  checkoutSubmissionUrl,
  relayErrorMessage,
  submitCheckoutRelay,
  type RelaySubmissionView,
} from '@/lib/checkout-submission'
import { prepareArcSigning } from '@/lib/arc-network'
import { env } from '@/lib/env'
import { strimzBrowserClient } from '@/lib/strimz-browser'
import { subscriptionSigningRequest, type SubscriptionRelayBody } from '@/lib/subscription-signing'
import { walletSignature } from '@/lib/wallet-signature'

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
  /** The plan id: the checkout relay path and the intent nonce's plan. */
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
  resolveStartAt?: () => Promise<bigint>
  /** Unix seconds after which the schedule stops; 0 = open-ended. */
  endAt?: bigint
  /** Allowance to grant via permit, bound into the intent. Defaults to
   *  type(uint256).max: a bounded permit runs out on open-ended plans and,
   *  because a permit replaces the allowance, would shrink the payer's
   *  other subscriptions in the same token (#384). */
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
  const resolveStartAt = inputs.resolveStartAt
  const permitValue = inputs.permitValue ?? UINT256_MAX
  const permitValidForSeconds = inputs.permitValidForSeconds ?? 24 * 60 * 60

  const { address } = useAccount()
  const config = useConfig()
  const { switchChainAsync } = useSwitchChain()
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
      const chainId = await prepareArcSigning(
        {
          chainId: () => Promise.resolve(getAccount(config).chainId),
          switchChain: (id) => switchChainAsync({ chainId: id }),
        },
        env.arcEnvironment,
      )
      const tokenAddress = tokenMeta.address as `0x${string}`
      const signedStartAt = resolveStartAt ? await resolveStartAt() : startAt

      // Read the payer's permit nonce right before signing. The intent
      // nonce is derived from it, so a retry while the first signup is
      // still pending signs the same intent nonce and can't enrol twice.
      const nonceResp = await strimzBrowserClient().tokens.permitNonce(tokenAddress, address)
      const permitNonce = BigInt(nonceResp.nonce)

      const now = Math.floor(Date.now() / 1000)
      const deadline = BigInt(now + permitValidForSeconds)

      const request = subscriptionSigningRequest({
        chainId,
        subscriptionsAddress: env.subscriptionsAddress as `0x${string}`,
        token: { address: tokenAddress, name: tokenMeta.name, version: tokenMeta.version },
        payer: address,
        planId: sessionId,
        merchantId,
        amount,
        interval: intervalSeconds,
        startAt: signedStartAt,
        endAt,
        permitValue,
        permitNonce,
        deadline,
      })
      const payerCode = await getBytecode(config, { address })
      const permitSig = walletSignature(
        (await signTypedDataAsync(
          request.permit as Parameters<typeof signTypedDataAsync>[0],
        )) as `0x${string}`,
        payerCode,
      )
      // Second signature: SubscriptionIntent. Blocks enrolment in a
      // plan the payer never picked.
      const intentSig = walletSignature(
        (await signTypedDataAsync(
          request.intent as Parameters<typeof signTypedDataAsync>[0],
        )) as `0x${string}`,
        payerCode,
      )

      setState((prev) => ({ ...prev, phase: 'submitting' }))

      const submission = await postSubmit(sessionId, request.body(permitSig, intentSig))

      const settled = mapTerminalPhase(submission.status)
      if (settled) {
        setState({ phase: settled, error: null, txHash: submission.txHash, submission })
        return
      }
      setState({ phase: 'polling', error: null, txHash: null, submission })
      await pollUntilTerminal(sessionId, submission.idempotencyKey, (next) => {
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
    config,
    switchChainAsync,
    sessionId,
    merchantId,
    tokenMeta,
    amount,
    intervalSeconds,
    startAt,
    resolveStartAt,
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

function postSubmit(sessionId: string, body: SubscriptionRelayBody): Promise<RelaySubmissionView> {
  return submitCheckoutRelay({ kind: 'plans', id: sessionId }, body)
}

async function pollUntilTerminal(
  sessionId: string,
  idempotencyKey: string,
  onUpdate: (view: RelaySubmissionView) => SubscriptionPhase | null,
): Promise<SubscriptionPhase> {
  const start = Date.now()
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const res = await fetch(
      checkoutSubmissionUrl({ kind: 'plans', id: sessionId }, idempotencyKey),
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
    return relayErrorMessage(await res.json(), fallback)
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
