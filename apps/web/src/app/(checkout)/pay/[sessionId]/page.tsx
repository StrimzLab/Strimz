'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useDisconnect } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'
import { Loader2, ShieldCheck, Wallet } from 'lucide-react'
import { Badge } from '@strimz/ui'
import type { PaymentSession, TokenMetadata } from '@strimz/shared-types'

import { CheckoutShell, StepIndicator } from '@/components/checkout/checkout-shell'
import { SubmitButton } from '@/components/auth/submit-button'
import { TokenLogo } from '@/components/shared/token-logo'
import { projectId as reownProjectId } from '@/lib/wagmi'
import { env } from '@/lib/env'
import { strimzBrowserClient } from '@/lib/strimz-browser'
import { usePayCheckout, type PayPhase } from '@/hooks/use-pay-checkout'

/**
 * Public hosted checkout for one-shot payment sessions.
 *
 * Loads the real session payload (amount, currency, tokenAddress,
 * chainMerchantId), looks up token capabilities, then drives the
 * EIP-3009 single-signature flow via `usePayCheckout`. A session whose
 * merchant isn't yet registered on-chain (chainMerchantId == null)
 * cannot be paid via meta-tx and the page surfaces a clear error
 * instead of letting the payer attempt a doomed signature.
 */
export default function PayPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  const router = useRouter()

  const { address, isConnected } = useAccount()
  const { open } = useAppKit()
  const { disconnect } = useDisconnect()

  const [session, setSession] = useState<PaymentSession | null>(null)
  const [tokenMeta, setTokenMeta] = useState<TokenMetadata | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Two sequential loads — session first (to discover the token),
  // then token metadata. Failure at either stage surfaces in
  // `loadError` and short-circuits the rest of the flow.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const s = await strimzBrowserClient().checkout.session(sessionId)
        if (cancelled) return
        setSession(s)
        if (!s.tokenAddress) {
          throw new Error(
            'session has no token address configured — set ARC_USDC_ADDRESS on the API',
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

  // Refuse to drive the hook with placeholder data — the visible
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

  const phase = derivePhase({
    hookPhase: pay.phase,
    isConnected,
    session,
    tokenMeta,
    chainMerchantId,
    loadError,
  })

  return (
    <CheckoutShell
      summary={{
        merchantName: 'Merchant',
        amount: amountDisplay,
        currency: tokenMeta?.symbol ?? session?.currency ?? 'USDC',
        description: session?.description ?? `Session ${sessionId}`,
      }}
      onCancel={() => router.push('/')}
    >
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
          phase !== 'not_ready' && <StepIndicator phase={phase} />}

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
                Wallet connect is unavailable — set <code>NEXT_PUBLIC_REOWN_PROJECT_ID</code>.
              </div>
            )}
            <SubmitButton type="button" onClick={() => open()} disabled={!reownProjectId}>
              <Wallet className="size-4" />
              Connect wallet
            </SubmitButton>
          </>
        )}

        {phase === 'ready' && (
          <>
            {address && <ConnectedRow address={address} onChange={disconnect} />}
            <SubmitButton
              type="button"
              onClick={() => void pay.submit()}
              disabled={!env.paymentsAddress}
            >
              <TokenLogo symbol={tokenMeta?.symbol ?? 'USDC'} size={18} />
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
          <div className="rounded-xl border border-[#02C76A]/30 bg-[#02C76A]/5 p-5 text-center text-sm">
            <p className="text-foreground font-medium">Payment complete</p>
            {pay.txHash && (
              <p className="text-muted-foreground mt-1 break-all font-mono text-xs">{pay.txHash}</p>
            )}
            <p className="text-muted-foreground mt-2 text-xs">
              The merchant has been notified via webhook.
            </p>
          </div>
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
            <li>Connect a wallet that holds {tokenMeta?.symbol ?? 'USDC'} on Arc.</li>
            <li>Sign once — Strimz submits the transaction for you.</li>
            <li>{tokenMeta?.symbol ?? 'USDC'} settles directly to the merchant.</li>
          </ol>
        </div>
      </div>
    </CheckoutShell>
  )
}

// ---- helpers ----

type VisiblePhase =
  | 'loading'
  | 'load_error'
  | 'not_ready'
  | 'connect'
  | 'ready'
  | 'signing'
  | 'submitting'
  | 'polling'
  | 'confirmed'
  | 'reverted'
  | 'failed'

function derivePhase(args: {
  hookPhase: PayPhase
  isConnected: boolean
  session: PaymentSession | null
  tokenMeta: TokenMetadata | null
  chainMerchantId: string | null
  loadError: string | null
}): VisiblePhase {
  const { hookPhase, isConnected, session, tokenMeta, chainMerchantId, loadError } = args
  if (loadError) return 'load_error'
  if (!session || !tokenMeta) return 'loading'
  if (!chainMerchantId) return 'not_ready'
  if (hookPhase === 'confirmed') return 'confirmed'
  if (hookPhase === 'reverted') return 'reverted'
  if (hookPhase === 'failed') return 'failed'
  if (hookPhase === 'signing') return 'signing'
  if (hookPhase === 'submitting') return 'submitting'
  if (hookPhase === 'polling') return 'polling'
  if (!isConnected) return 'connect'
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
    case 'ready':
      return 'One signature — Strimz settles the payment and notifies the merchant.'
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
 * — uses string slicing so very large amounts (uint256) don't risk
 * Number truncation.
 */
function formatAmount(baseUnits: bigint, decimals: number): string {
  if (baseUnits === 0n) return '0.00'
  const s = baseUnits.toString().padStart(decimals + 1, '0')
  const whole = s.slice(0, -decimals)
  const frac = s.slice(-decimals).replace(/0+$/, '')
  return frac ? `${whole}.${frac}` : `${whole}.00`
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

function ErrorBanner({ message, retry }: { message: string; retry?: () => Promise<void> }) {
  return (
    <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700">
      <p>{message}</p>
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
