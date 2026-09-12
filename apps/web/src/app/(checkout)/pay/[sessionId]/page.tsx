'use client'

import { use, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useDisconnect, useReadContract } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'
import { ArrowRight, CheckCircle2, ExternalLink, Loader2, ShieldCheck, Wallet } from 'lucide-react'
import { Badge, FieldLabel, Input } from '@strimz/ui'
import type { MerchantPublicBrand, PaymentSession, TokenMetadata } from '@strimz/shared-types'
import { erc20Abi } from 'viem'
import {
  chainIdFor,
  getTokenAddress,
  listCctpSourceChains,
  type CCTPSourceChain,
} from '@strimz/shared-config'

import { CheckoutShell, StepIndicator } from '@/components/checkout/checkout-shell'
import { WalletPickerGuard } from '@/components/checkout/wallet-picker-guard'
import { SubmitButton } from '@/components/auth/submit-button'
import { TokenLogo } from '@/components/shared/token-logo'
import { projectId as reownProjectId } from '@/lib/wagmi'
import { env } from '@/lib/env'
import { strimzBrowserClient } from '@/lib/strimz-browser'
import { attachSessionPayer } from '@/lib/checkout-payer'
import { usePayCheckout, type PayPhase } from '@/hooks/use-pay-checkout'
import { fetchBridgeState, useBridgeFunding, type BridgePhase } from '@/hooks/use-bridge-funding'

/**
 * Public hosted checkout for one-shot payment sessions.
 *
 * Loads the real session payload (amount, currency, tokenAddress,
 * chainMerchantId), looks up token capabilities, then drives the
 * EIP-3009 single-signature flow via `usePayCheckout`. A session whose
 * merchant isn't yet registered on-chain (chainMerchantId == null)
 * cannot be paid via meta-tx and the page surfaces a clear error
 * instead of letting the payer attempt a doomed signature.
 *
 * A payer holding USDC somewhere other than Arc gets a funding step
 * first (`useBridgeFunding`), which CCTPs the amount to their own Arc
 * address. Everything after that is the same single signature. The
 * funding step is resumable: the burn is recorded server-side, so a
 * payer who closes the tab mid-transfer comes back to a wait, not a
 * second burn.
 */
export default function PayPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  const router = useRouter()

  const { address, isConnected } = useAccount()
  const { open } = useAppKit()
  const { disconnect } = useDisconnect()

  const [session, setSession] = useState<PaymentSession | null>(null)
  const [tokenMeta, setTokenMeta] = useState<TokenMetadata | null>(null)
  const [brand, setBrand] = useState<MerchantPublicBrand | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [attaching, setAttaching] = useState(false)
  const [sourceChain, setSourceChain] = useState<CCTPSourceChain>(
    () => listCctpSourceChains(env.arcEnvironment)[0] ?? 'arbitrum',
  )

  // Two sequential loads. Session first (to discover the token),
  // then token metadata. Failure at either stage surfaces in
  // `loadError` and short-circuits the rest of the flow. The brand
  // read is fire-and-forget — a failure just leaves the initial mark.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const s = await strimzBrowserClient().checkout.session(sessionId)
        if (cancelled) return
        setSession(s)
        void strimzBrowserClient()
          .checkout.merchant(s.merchantId)
          .then((b) => {
            if (!cancelled) setBrand(b)
          })
          .catch(() => {})
        if (!s.tokenAddress) {
          throw new Error(
            'session has no token address configured. Set ARC_USDC_ADDRESS on the API',
          )
        }
        const meta = await strimzBrowserClient().tokens.retrieve(s.tokenAddress)
        if (!cancelled) setTokenMeta(meta)
      } catch (err) {
        if (!cancelled) setLoadError((err as Error).message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  // Refuse to drive the hook with placeholder data. The visible
  // phase mapping below renders an explicit "not ready" state when
  // the on-chain registry id is missing.
  const chainMerchantId = session?.chainMerchantId ?? null
  const amountBaseUnits = session ? BigInt(session.amount) : 0n
  const amountDisplay = formatAmount(amountBaseUnits, tokenMeta?.decimals ?? 6)

  const pay = usePayCheckout({
    sessionId,
    merchantId: chainMerchantId ? BigInt(chainMerchantId) : 0n,
    tokenMeta: tokenMeta ?? PLACEHOLDER_TOKEN,
    amount: amountBaseUnits,
  })

  const fundingChains = listCctpSourceChains(env.arcEnvironment)
  const bridge = useBridgeFunding({ sessionId, sourceChain, amount: amountBaseUnits })

  // What the payer holds on Arc decides whether they see the funding
  // step at all. Undefined while it loads — treated as "not short" so
  // we never flash a funding prompt at someone already holding USDC.
  const { data: arcBalance, refetch: refetchArcBalance } = useReadContract({
    chainId: chainIdFor(env.arcEnvironment),
    address: getTokenAddress(env.arcEnvironment, 'USDC'),
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  })
  const needsFunding =
    isConnected && arcBalance !== undefined && amountBaseUnits > 0n && arcBalance < amountBaseUnits

  useEffect(() => {
    if (bridge.phase === 'funded') void refetchArcBalance()
  }, [bridge.phase, refetchArcBalance])

  // A burn recorded against this session that hasn't landed yet means
  // the payer left mid-transfer. Rejoin the wait instead of offering
  // them a second burn.
  const resumeRef = useRef(false)
  useEffect(() => {
    if (!needsFunding || resumeRef.current) return
    resumeRef.current = true
    void (async () => {
      try {
        const state = await fetchBridgeState(sessionId)
        if (state.bridgeTxHash) void bridge.resume()
      } catch {
        // A failed check just means no resume; `fund()` re-checks
        // properly before it lets the payer spend anything.
      }
    })()
  }, [needsFunding, sessionId, bridge])

  const phase = derivePhase({
    hookPhase: pay.phase,
    bridgePhase: bridge.phase,
    needsFunding,
    isConnected,
    session,
    tokenMeta,
    chainMerchantId,
    loadError,
  })

  return (
    <CheckoutShell
      summary={{
        merchantName: brand?.businessName,
        merchantLogoUrl: brand?.logoUrl ?? null,
        merchantWalletAddress: brand?.walletAddress ?? null,
        amount: amountDisplay,
        currency: tokenMeta?.symbol ?? session?.currency ?? 'USDC',
        description: session?.description ?? `Session ${sessionId}`,
      }}
      onCancel={() => router.push('/')}
    >
      <WalletPickerGuard />
      <div className="space-y-6">
        <div>
          <Badge variant="outline" className="mb-3 gap-1.5">
            <ShieldCheck className="size-3 text-[#02C76A]" />
            Secured by Strimz
          </Badge>
          <h2 className="font-poppins flex items-center gap-2 text-2xl font-semibold tracking-tight">
            {phase === 'confirmed' ? (
              'Payment confirmed'
            ) : (
              <>
                Pay with <TokenLogo symbol={tokenMeta?.symbol ?? 'USDC'} size={24} />
                {tokenMeta?.symbol ?? session?.currency ?? 'USDC'}
              </>
            )}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">{phaseDescription(phase, pay.error)}</p>
        </div>

        {phase !== 'connect' &&
          phase !== 'loading' &&
          phase !== 'load_error' &&
          phase !== 'not_ready' &&
          phase !== 'funding' &&
          phase !== 'bridging' && <StepIndicator phase={phase} />}

        {phase === 'load_error' && <ErrorBanner message={loadError ?? 'Failed to load session.'} />}

        {phase === 'not_ready' && (
          <ErrorBanner
            message={
              'This merchant has not been registered on-chain yet. Payments will be available once Strimz completes their on-chain enrolment.'
            }
          />
        )}

        {phase === 'loading' && <BusyState phase="loading" />}

        {phase === 'connect' && (
          <>
            {!reownProjectId && (
              <div className="font-poppins rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700">
                Wallet connect is unavailable. Set <code>NEXT_PUBLIC_REOWN_PROJECT_ID</code>.
              </div>
            )}
            <SubmitButton type="button" onClick={() => open()} disabled={!reownProjectId}>
              <Wallet className="size-4" />
              Connect wallet
            </SubmitButton>
          </>
        )}

        {phase === 'funding' && (
          <>
            {address && <ConnectedRow address={address} onChange={disconnect} />}
            <div className="border-border space-y-3 rounded-lg border p-4">
              <p className="text-sm">
                This merchant settles on Arc. Move {amountDisplay} {tokenMeta?.symbol ?? 'USDC'}{' '}
                across and we will bring you back here to sign.
              </p>
              {fundingChains.length > 1 && (
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="funding-chain" required>
                    Pay from
                  </FieldLabel>
                  <select
                    id="funding-chain"
                    className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm capitalize"
                    value={sourceChain}
                    onChange={(e) => setSourceChain(e.target.value as CCTPSourceChain)}
                  >
                    {fundingChains.map((c) => (
                      <option key={c} value={c} className="capitalize">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <p className="text-muted-foreground text-xs">
                Two transactions on <span className="capitalize">{sourceChain}</span>, paid in that
                chain&apos;s gas. The USDC lands in your own wallet on Arc — nothing is held by us
                in between.
              </p>
            </div>
            {bridge.error && (
              <ErrorBanner
                message={bridge.error}
                // Once a burn exists the payer has spent real money. Show
                // the hash whatever went wrong afterwards — it is the only
                // handle they or support have on those funds.
                detail={bridge.burnTxHash ? `Your transfer: ${bridge.burnTxHash}` : null}
              />
            )}
            <SubmitButton type="button" onClick={() => void bridge.fund()}>
              <ArrowRight className="size-4" />
              Move {amountDisplay} {tokenMeta?.symbol ?? 'USDC'} from{' '}
              <span className="capitalize">{sourceChain}</span>
            </SubmitButton>
          </>
        )}

        {phase === 'bridging' && (
          <>
            {address && <ConnectedRow address={address} onChange={disconnect} />}
            <BridgingState phase={bridge.phase} sourceChain={sourceChain} />
          </>
        )}

        {phase === 'ready' && (
          <>
            {address && <ConnectedRow address={address} onChange={disconnect} />}
            <div className="space-y-1.5">
              <FieldLabel htmlFor="payer-email" required>
                Email for receipt
              </FieldLabel>
              <Input
                id="payer-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (emailError) setEmailError(null)
                }}
                aria-invalid={emailError ? true : undefined}
                aria-describedby={emailError ? 'payer-email-error' : undefined}
              />
              {emailError ? (
                <p id="payer-email-error" className="text-xs text-red-600">
                  {emailError}
                </p>
              ) : (
                <p className="text-muted-foreground text-xs">
                  We send your receipt here once the payment settles on-chain.
                </p>
              )}
            </div>
            <SubmitButton
              type="button"
              onClick={() =>
                void handlePayClick({
                  email,
                  address,
                  sessionId,
                  setEmailError,
                  setAttaching,
                  onReady: () => void pay.submit(),
                })
              }
              disabled={!env.paymentsAddress || attaching}
            >
              {attaching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <TokenLogo symbol={tokenMeta?.symbol ?? 'USDC'} size={18} />
              )}
              Pay {amountDisplay} {tokenMeta?.symbol ?? 'USDC'}
            </SubmitButton>
          </>
        )}

        {(phase === 'signing' || phase === 'submitting' || phase === 'polling') && (
          <>
            {address && <ConnectedRow address={address} onChange={disconnect} />}
            <BusyState phase={phase} />
          </>
        )}

        {phase === 'confirmed' && (
          <CompletionPanel
            // `pay.txHash` is set when the hook just drove the flow;
            // `session.onchainTxHash` is set when a previous attempt
            // already settled and the indexer projected it back. Prefer
            // the live one if both exist (they should be equal anyway).
            txHash={pay.txHash ?? session?.onchainTxHash ?? null}
            successUrl={session?.successUrl ?? null}
          />
        )}

        {(phase === 'reverted' || phase === 'failed') && (
          <ErrorBanner
            message={pay.error ?? 'The payment did not go through.'}
            retry={pay.submit}
          />
        )}

        <div className="bg-muted/30 text-muted-foreground rounded-lg p-4 text-xs">
          <p className="text-foreground font-medium">How it works</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              Connect a wallet holding {tokenMeta?.symbol ?? 'USDC'}. Not on Arc? We move it across
              first.
            </li>
            <li>Sign once. Strimz submits the transaction for you.</li>
            <li>{tokenMeta?.symbol ?? 'USDC'} settles directly to the merchant.</li>
          </ol>
        </div>
      </div>
    </CheckoutShell>
  )
}

// ---- helpers ----

async function handlePayClick(args: {
  email: string
  address: string | undefined
  sessionId: string
  setEmailError: (v: string | null) => void
  setAttaching: (v: boolean) => void
  onReady: () => void
}): Promise<void> {
  const trimmed = args.email.trim()
  if (!isValidEmail(trimmed)) {
    args.setEmailError('Enter a valid email address so we can send your receipt.')
    return
  }
  if (!args.address) {
    args.setEmailError('Reconnect your wallet and try again.')
    return
  }
  args.setAttaching(true)
  try {
    await attachSessionPayer({
      sessionId: args.sessionId,
      email: trimmed,
      walletAddress: args.address,
    })
    args.onReady()
  } catch (err) {
    args.setEmailError((err as Error).message)
  } finally {
    args.setAttaching(false)
  }
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)
}

type VisiblePhase =
  | 'loading'
  | 'load_error'
  | 'not_ready'
  | 'connect'
  | 'funding'
  | 'bridging'
  | 'ready'
  | 'signing'
  | 'submitting'
  | 'polling'
  | 'confirmed'
  | 'reverted'
  | 'failed'

function derivePhase(args: {
  hookPhase: PayPhase
  bridgePhase: BridgePhase
  needsFunding: boolean
  isConnected: boolean
  session: PaymentSession | null
  tokenMeta: TokenMetadata | null
  chainMerchantId: string | null
  loadError: string | null
}): VisiblePhase {
  const {
    hookPhase,
    bridgePhase,
    needsFunding,
    isConnected,
    session,
    tokenMeta,
    chainMerchantId,
    loadError,
  } = args
  if (loadError) return 'load_error'
  if (!session || !tokenMeta) return 'loading'
  // Server-side already-paid short-circuit. A page reload after a
  // successful payment loads a session row whose status the indexer
  // has flipped to `confirmed`. Jump straight to the completion view
  //. Never re-mount the wallet flow, never prompt for a second
  // signature. The API also rejects a re-submission on this session,
  // so even an attacker bypassing the page can't double-charge.
  if (session.status === 'confirmed') return 'confirmed'
  if (!chainMerchantId) return 'not_ready'
  if (hookPhase === 'confirmed') return 'confirmed'
  if (hookPhase === 'reverted') return 'reverted'
  if (hookPhase === 'failed') return 'failed'
  if (hookPhase === 'signing') return 'signing'
  if (hookPhase === 'submitting') return 'submitting'
  if (hookPhase === 'polling') return 'polling'
  if (!isConnected) return 'connect'
  // Funding sits between connect and ready: the payer has a wallet but
  // not the balance to sign against. A failed bridge falls back to the
  // funding prompt with the error rather than the payment error panel,
  // since nothing about the payment has been attempted yet.
  if (bridgePhase !== 'idle' && bridgePhase !== 'funded' && bridgePhase !== 'failed') {
    return 'bridging'
  }
  if (needsFunding) return 'funding'
  return 'ready'
}

function phaseDescription(phase: VisiblePhase, error: string | null): string {
  switch (phase) {
    case 'loading':
      return 'Loading session…'
    case 'load_error':
      return 'We could not load this checkout.'
    case 'not_ready':
      return ''
    case 'connect':
      return 'Connect a wallet to continue. We use Reown AppKit to support every major wallet.'
    case 'funding':
      return error ?? 'You need USDC on Arc to pay. Move it across from another chain first.'
    case 'bridging':
      return 'Moving your USDC to Arc. This might take a while — hang tight.'
    case 'ready':
      return 'One signature. Strimz settles the payment and notifies the merchant.'
    case 'signing':
      return 'Confirm the signature in your wallet.'
    case 'submitting':
      return 'Submitting your signed authorization to the network…'
    case 'polling':
      return 'Waiting for on-chain confirmation. Arc finalises in under a second.'
    case 'confirmed':
      return ''
    case 'reverted':
      return 'The transaction was rejected on-chain.'
    case 'failed':
      return error ?? 'Something went wrong before the transaction was submitted.'
  }
}

/**
 * Format a base-units bigint as a token-decimals-correct display
 * string. `50000000` at 6 decimals → `"50.00"`. Intentionally simple
 *. Uses string slicing so very large amounts (uint256) don't risk
 * Number truncation.
 */
function formatAmount(baseUnits: bigint, decimals: number): string {
  if (baseUnits === 0n) return '0.00'
  const s = baseUnits.toString().padStart(decimals + 1, '0')
  const whole = s.slice(0, -decimals)
  const frac = s.slice(-decimals).replace(/0+$/, '')
  return frac ? `${whole}.${frac}` : `${whole}.00`
}

function BridgingState({ phase, sourceChain }: { phase: BridgePhase; sourceChain: string }) {
  const label =
    phase === 'checking'
      ? 'Checking this payment is still open…'
      : phase === 'switching'
        ? `Switch your wallet to ${sourceChain} to continue.`
        : phase === 'approving'
          ? 'Approve USDC in your wallet.'
          : phase === 'burning'
            ? 'Confirm the transfer in your wallet.'
            : 'Safe to leave this page — we pick up where you left off when you come back.'

  return (
    <div className="text-muted-foreground flex items-center gap-3 py-6 text-sm">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  )
}

function BusyState({ phase }: { phase: 'loading' | 'signing' | 'submitting' | 'polling' }) {
  const label =
    phase === 'loading'
      ? 'Loading…'
      : phase === 'signing'
        ? 'Awaiting wallet signature…'
        : phase === 'submitting'
          ? 'Submitting…'
          : 'Confirming on-chain…'
  return (
    <div className="bg-muted/30 flex items-center gap-3 rounded-md px-3 py-3 text-sm">
      <Loader2 className="size-4 animate-spin text-[#02C76A]" />
      <span>{label}</span>
    </div>
  )
}

/**
 * Terminal "payment complete" state. Three blocks, top-down:
 *
 *   1. Hero. Checkmark, primary headline, network sub-line so the
 *              payer knows which chain settled the funds (mainnet vs
 *              testnet matters at a glance).
 *   2. Detail. A single "Transaction" row with the truncated tx hash
 *              linked out to Arcscan. The full hash is verifiable but
 *              shouldn't dominate the card.
 *   3. Next-step. If the merchant configured `successUrl`, a counted-
 *              down primary button labeled "Return to merchant". The
 *              countdown text sits above the button so the user reads
 *              "Returning in Xs" → action button → click. Without
 *              `successUrl`, the user gets an honest "you can close
 *              this window" line and stays put.
 *
 * The misleading "merchant has been notified via webhook" claim from
 * the earlier copy is gone. Webhooks only fire when the merchant has
 * registered an endpoint, and we can't honestly assert delivery from
 * the payer's page either way.
 */
function CompletionPanel({
  txHash,
  successUrl,
}: {
  txHash: string | null
  successUrl: string | null
}) {
  // 8 seconds gives the payer time to register the confirmation and
  // skim the tx hash, but keeps the flow feeling like it has somewhere
  // to go. The "Return to merchant" button below skips the wait.
  const REDIRECT_AFTER_SECONDS = 8
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_AFTER_SECONDS)

  useEffect(() => {
    if (!successUrl) return
    if (secondsLeft <= 0) {
      window.location.href = successUrl
      return
    }
    const t = window.setTimeout(() => setSecondsLeft((n) => n - 1), 1_000)
    return () => window.clearTimeout(t)
  }, [secondsLeft, successUrl])

  const explorerHref = txHash ? explorerTxUrl(txHash, env.arcEnvironment) : null
  const shortHash = txHash ? `${txHash.slice(0, 6)}…${txHash.slice(-4)}` : null
  const networkLabel = env.arcEnvironment === 'mainnet' ? 'Arc Mainnet' : 'Arc Testnet'

  return (
    <div className="rounded-xl border border-[#02C76A]/30 bg-[#02C76A]/5 px-5 py-6">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#02C76A]/15">
          <CheckCircle2 className="size-7 text-[#02C76A]" />
        </div>
        <h3 className="font-poppins text-foreground mt-3 text-base font-semibold tracking-tight">
          Payment complete
        </h3>
        <p className="text-muted-foreground mt-1 text-xs">Settled on {networkLabel}</p>
      </div>

      {txHash && explorerHref && (
        <div className="mt-5 flex items-center justify-between rounded-md border border-[#E5E7EB] bg-white/60 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Transaction</span>
          <a
            href={explorerHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground inline-flex items-center gap-1 font-mono font-[500] underline-offset-2 hover:text-[#02C76A] hover:underline"
          >
            {shortHash}
            <ExternalLink className="size-3" />
          </a>
        </div>
      )}

      {successUrl ? (
        <div className="mt-5 space-y-3">
          <p className="text-muted-foreground text-center text-xs">
            Returning to merchant in {secondsLeft}s…
          </p>
          <SubmitButton
            type="button"
            onClick={() => {
              window.location.href = successUrl
            }}
          >
            Return to merchant
            <ArrowRight className="size-4" />
          </SubmitButton>
        </div>
      ) : (
        <p className="text-muted-foreground mt-5 text-center text-xs">
          You can safely close this window.
        </p>
      )}
    </div>
  )
}

/**
 * Arcscan (Blockscout-v2) tx URL. Two-domain lookup keeps the success
 * card honest about which network the funds actually moved on without
 * having to thread environment into a util.
 */
function explorerTxUrl(hash: string, arcEnv: 'testnet' | 'mainnet'): string {
  const base = arcEnv === 'mainnet' ? 'https://arcscan.app' : 'https://testnet.arcscan.app'
  return `${base}/tx/${hash}`
}

function ErrorBanner({
  message,
  retry,
  detail,
}: {
  message: string
  retry?: () => Promise<void>
  detail?: string | null
}) {
  return (
    <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700">
      <p>{message}</p>
      {detail && <p className="mt-2 break-all font-mono text-xs opacity-80">{detail}</p>}
      {retry && (
        <button
          type="button"
          onClick={() => void retry()}
          className="mt-2 text-xs font-medium underline"
        >
          Try again
        </button>
      )}
    </div>
  )
}

function ConnectedRow({ address, onChange }: { address: string; onChange: () => void }) {
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`
  return (
    <div className="font-poppins flex items-center justify-between rounded-md border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2 text-xs">
      <span className="flex items-center gap-2">
        <Wallet className="size-3.5 text-[#02C76A]" />
        <span className="font-mono">{short}</span>
      </span>
      <button
        type="button"
        onClick={onChange}
        className="font-[500] text-[#58556A] hover:text-[#050020]"
      >
        Change
      </button>
    </div>
  )
}

/**
 * Used only while token metadata is still loading. Has zero
 * capabilities so an accidental submission attempt before the real
 * metadata lands fails loudly in `usePayCheckout.submit()`.
 */
const PLACEHOLDER_TOKEN: TokenMetadata = {
  address: '0x0000000000000000000000000000000000000000',
  name: 'USDC',
  symbol: 'USDC',
  version: '1',
  decimals: 6,
  capabilities: { permit2612: false, transferAuth3009: false },
}
