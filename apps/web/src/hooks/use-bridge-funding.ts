'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from 'wagmi'
import { erc20Abi, pad } from 'viem'
import {
  CCTP_DOMAIN_IDS,
  CCTP_FINALITY_FAST,
  chainIdFor,
  getCctpSourceContracts,
  getTokenAddress,
  type CCTPSourceChain,
} from '@strimz/shared-config'

import { env } from '@/lib/env'
import { tokenMessengerV2Abi } from '@/lib/cctp-abi'
import {
  burnAmountFor,
  defaultMaxFee,
  hasArrived,
  preflightRefusal,
  smartWalletRefusal,
} from '@/lib/cctp-funding'

/**
 * Funds a hosted checkout from a chain other than Arc.
 *
 * The payer burns USDC on their own chain; Circle attests; the
 * scheduler mints it to the payer's *own* address on Arc. Once the
 * mint lands, the normal `usePayCheckout` flow runs unchanged — the
 * payer signs EIP-3009 and the relayer pays the merchant.
 *
 * Everything that can refuse the payer runs before the burn: the
 * session check, the contract-account check, the balance check. After
 * `depositForBurn` the payer has spent real money and there is no
 * useful way to tell them we changed our mind.
 *
 * They sign two source-chain transactions and pay gas in that chain's
 * native token. They never need Arc gas — the scheduler relays the
 * mint, and the payment itself is a signature.
 */

export interface BridgeFundingInputs {
  sessionId: string
  sourceChain: CCTPSourceChain
  /**
   * What the payer must end up holding on Arc, in USDC base units —
   * the session's gross amount. We burn this plus the fee ceiling, so
   * this exact number survives the bridge.
   */
  amount: bigint
  /**
   * Ceiling on Circle's fast-transfer fee, in base units. Defaults to
   * 2bps of `amount`, comfortably above the ~1bps Circle charges. The
   * exact quote lives at Circle's `/v2/burn/USDC/fees` endpoint; we
   * pass a ceiling instead so the burn doesn't need a second round
   * trip before the payer can sign. Under-quoting is not fatal —
   * Circle falls back to standard finality, which is free and slower.
   */
  maxFee?: bigint
}

export type BridgePhase =
  | 'idle'
  | 'checking'
  | 'switching'
  | 'approving'
  | 'burning'
  | 'bridging'
  | 'funded'
  | 'failed'

export interface BridgeFundingState {
  phase: BridgePhase
  error: string | null
  burnTxHash: `0x${string}` | null
}

interface UseBridgeFundingResult extends BridgeFundingState {
  /** Full flow, from preflight to funds landing on Arc. */
  fund: () => Promise<void>
  /** Pick up a burn that already happened — a reload mid-bridge. */
  resume: () => Promise<void>
}

const POLL_INTERVAL_MS = 3000
/** Fast transfer lands in ~13s. The ceiling covers a fee ceiling that
 *  came in under Circle's quote and dropped us to standard finality. */
const MINT_TIMEOUT_MS = 20 * 60_000

export function useBridgeFunding(inputs: BridgeFundingInputs): UseBridgeFundingResult {
  const { sessionId, sourceChain, amount } = inputs
  const maxFee = inputs.maxFee ?? defaultMaxFee(amount)

  const { address } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()

  const arcChainId = chainIdFor(env.arcEnvironment)
  const source = getCctpSourceContracts(env.arcEnvironment, sourceChain)

  const arcClient = usePublicClient({ chainId: arcChainId })
  const sourceClient = usePublicClient({ chainId: source?.chainId })

  const [state, setState] = useState<BridgeFundingState>({
    phase: 'idle',
    error: null,
    burnTxHash: null,
  })

  const inFlightRef = useRef(false)

  /** Balance the payer must reach on Arc for the payment to go through. */
  const waitForMint = useCallback(async () => {
    if (!arcClient || !address) throw new Error('wallet not connected')
    const arcUsdc = getTokenAddress(env.arcEnvironment, 'USDC')
    const start = Date.now()
    while (Date.now() - start < MINT_TIMEOUT_MS) {
      const balance = await arcClient.readContract({
        address: arcUsdc,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      })
      if (hasArrived(balance, amount)) return
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    }
    throw new Error(
      'Your USDC has not arrived on Arc yet. It is not lost — reload this page and we will pick up where the transfer left off.',
    )
  }, [arcClient, address, amount])

  const fund = useCallback(async () => {
    if (inFlightRef.current) return
    if (!address) {
      setState((s) => ({ ...s, phase: 'failed', error: 'wallet not connected' }))
      return
    }
    if (!source) {
      setState((s) => ({
        ...s,
        phase: 'failed',
        error: `${sourceChain} is not a supported funding chain on ${env.arcEnvironment}`,
      }))
      return
    }
    if (!arcClient || !sourceClient) {
      setState((s) => ({ ...s, phase: 'failed', error: 'rpc client unavailable' }))
      return
    }

    inFlightRef.current = true
    setState({ phase: 'checking', error: null, burnTxHash: null })

    try {
      const burnAmount = burnAmountFor(amount, maxFee)

      await assertSessionFundable(sessionId)
      await assertPayerControlsArcAddress(arcClient, address)

      const balance = await sourceClient.readContract({
        address: source.usdc,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      })
      if (balance < burnAmount) {
        throw new Error(`Not enough USDC on ${sourceChain} to cover the payment and bridge fee.`)
      }

      setState((prev) => ({ ...prev, phase: 'switching' }))
      await switchChainAsync({ chainId: source.chainId })

      const allowance = await sourceClient.readContract({
        address: source.usdc,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address, source.tokenMessengerV2],
      })
      if (allowance < burnAmount) {
        setState((prev) => ({ ...prev, phase: 'approving' }))
        const approveHash = await writeContractAsync({
          chainId: source.chainId,
          address: source.usdc,
          abi: erc20Abi,
          functionName: 'approve',
          args: [source.tokenMessengerV2, burnAmount],
        })
        await sourceClient.waitForTransactionReceipt({ hash: approveHash })
      }

      setState((prev) => ({ ...prev, phase: 'burning' }))
      const burnTxHash = await writeContractAsync({
        chainId: source.chainId,
        address: source.tokenMessengerV2,
        abi: tokenMessengerV2Abi,
        functionName: 'depositForBurn',
        args: [
          burnAmount,
          CCTP_DOMAIN_IDS.arc,
          pad(address),
          source.usdc,
          // Empty destinationCaller: anyone may relay the mint. The
          // scheduler does, but leaving it open means a stuck relayer
          // can't strand the payer's funds mid-flight.
          pad('0x'),
          maxFee,
          CCTP_FINALITY_FAST,
        ],
      })
      setState((prev) => ({ ...prev, phase: 'bridging', burnTxHash }))

      // Record the burn before waiting for it to confirm. The payer's
      // money is already gone the moment the transaction broadcasts, and
      // until the server knows the hash nothing will ever relay the
      // mint — so this window is the one place a closed tab can strand
      // funds. Posting here shrinks it to a single HTTP round trip.
      //
      // The cost is that a burn which later reverts still occupies the
      // session's `bridgeTxHash`, so the payer cannot retry on the same
      // session without help. That trade is deliberate: a blocked retry
      // is an inconvenience, an unrelayed burn is lost money.
      await postBridge(sessionId, { sourceChain, burnTxHash })

      const receipt = await sourceClient.waitForTransactionReceipt({ hash: burnTxHash })
      if (receipt.status === 'reverted') {
        throw new Error(
          `The transfer reverted on ${sourceChain} (${burnTxHash}). Nothing was taken from ` +
            'your wallet, but this payment is now tied to that attempt — start a new one.',
        )
      }

      await waitForMint()
      setState((prev) => ({ ...prev, phase: 'funded' }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error'
      setState((prev) => ({ ...prev, phase: 'failed', error: message }))
    } finally {
      inFlightRef.current = false
    }
  }, [
    address,
    amount,
    maxFee,
    sessionId,
    sourceChain,
    source,
    arcClient,
    sourceClient,
    switchChainAsync,
    writeContractAsync,
    waitForMint,
  ])

  /**
   * The payer already burned — they reloaded, or came back later. The
   * funds are in flight to an address they control, so there is
   * nothing to re-sign and nothing to recover. Just wait.
   */
  const resume = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setState((prev) => ({ ...prev, phase: 'bridging', error: null }))
    try {
      await waitForMint()
      setState((prev) => ({ ...prev, phase: 'funded' }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error'
      setState((prev) => ({ ...prev, phase: 'failed', error: message }))
    } finally {
      inFlightRef.current = false
    }
  }, [waitForMint])

  useEffect(() => {
    setState({ phase: 'idle', error: null, burnTxHash: null })
  }, [sessionId, sourceChain])

  return { ...state, fund, resume }
}

// ---- helpers (local glue, same rationale as use-pay-checkout) ----

interface BridgeStateView {
  fundable: boolean
  reason: string | null
  sourceChain: string | null
  bridgeTxHash: string | null
}

export async function fetchBridgeState(sessionId: string): Promise<BridgeStateView> {
  const res = await fetch(`/api/checkout/sessions/${encodeURIComponent(sessionId)}/bridge`, {
    cache: 'no-store',
  })
  if (!res.ok) {
    const detail = await res
      .json()
      .catch(() => ({ message: `bridge check failed (${res.status})` }))
    throw new Error(detail.message ?? `bridge check failed (${res.status})`)
  }
  return (await res.json()) as BridgeStateView
}

async function assertSessionFundable(sessionId: string): Promise<void> {
  const refusal = preflightRefusal(await fetchBridgeState(sessionId))
  if (refusal) throw new Error(refusal)
}

async function assertPayerControlsArcAddress(
  client: NonNullable<ReturnType<typeof usePublicClient>>,
  payer: `0x${string}`,
): Promise<void> {
  const refusal = smartWalletRefusal(await client.getCode({ address: payer }))
  if (refusal) throw new Error(refusal)
}

interface BridgeBody {
  sourceChain: CCTPSourceChain
  burnTxHash: `0x${string}`
}

async function postBridge(sessionId: string, body: BridgeBody): Promise<void> {
  const res = await fetch(`/api/checkout/sessions/${encodeURIComponent(sessionId)}/bridge`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ message: `bridge failed (${res.status})` }))
    throw new Error(detail.message ?? `bridge failed (${res.status})`)
  }
}
