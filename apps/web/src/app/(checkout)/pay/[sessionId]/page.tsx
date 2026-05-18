'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useDisconnect } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'
import { Loader2, ShieldCheck, Wallet } from 'lucide-react'
import { Badge } from '@strimz/ui'
import type { TokenMetadata } from '@strimz/shared-types'

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
 * Flow (collapsed by EIP-3009 — one signature, no separate approve):
 *
 *   1. Load token metadata + capabilities.
 *   2. Payer opens AppKit modal, picks a wallet.
 *   3. Single "Pay X USDC" button kicks `usePayCheckout.submit()`,
 *      which builds the EIP-712 typed-data, asks the wallet to sign,
 *      POSTs to the BFF, then polls the relay submission until it
 *      confirms (or reverts/fails).
 *   4. Success or error UI.
 *
 * The mock placeholder data (50.00 USDC, "Demo Merchant") will be
 * replaced with real session data once `paymentSessions.retrieve()`
 * grows the `chainMerchantId` + token-address fields needed to drive
 * the meta-tx (tracked as a follow-up — see Task #55 commit notes).
 */
export default function PayPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  const router = useRouter()

  const { address, isConnected } = useAccount()
  const { open } = useAppKit()
  const { disconnect } = useDisconnect()

  const [tokenMeta, setTokenMeta] = useState<TokenMetadata | null>(null)
  const [tokenError, setTokenError] = useState<string | null>(null)

  // Load token metadata (capabilities + EIP-712 domain name/version)
  // from the Strimz API. Public endpoint, no auth needed.
  useEffect(() => {
    if (!env.usdcAddress) {
      setTokenError('NEXT_PUBLIC_STRIMZ_USDC_ADDRESS is not configured')
      return
    }
    let cancelled = false
    strimzBrowserClient()
      .tokens.retrieve(env.usdcAddress)
      .then((meta) => {
        if (!cancelled) setTokenMeta(meta)
      })
      .catch((err: Error) => {
        if (!cancelled) setTokenError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // TODO(session-schema): real chainMerchantId + token + amount must
  // come from the session payload. Sessions don't expose those yet;
  // the hardcoded fixture below is for the v1 demo only.
  const DEMO_CHAIN_MERCHANT_ID = 1n
  const DEMO_AMOUNT_BASE_UNITS = 50_000_000n // 50.00 USDC (6 decimals)
  const DEMO_AMOUNT_DISPLAY = '50.00'

  const pay = usePayCheckout({
    sessionId,
    merchantId: DEMO_CHAIN_MERCHANT_ID,
    tokenMeta: tokenMeta ?? PLACEHOLDER_TOKEN,
    amount: DEMO_AMOUNT_BASE_UNITS,
  })

  const phase = derivePhase(pay.phase, isConnected, tokenMeta)

  return (
    <CheckoutShell
      summary={{
        merchantName: 'Demo Merchant',
        amount: DEMO_AMOUNT_DISPLAY,
        currency: tokenMeta?.symbol ?? 'USDC',
        description: `Session ${sessionId}`,
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
                {tokenMeta?.symbol ?? 'USDC'}
              </>
            )}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">{phaseDescription(phase, pay.error)}</p>
        </div>

        {phase !== 'connect' && <StepIndicator phase={phase} />}

        {tokenError && <ErrorBanner message={tokenError} />}

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
              disabled={!tokenMeta || !env.paymentsAddress}
            >
              <TokenLogo symbol={tokenMeta?.symbol ?? 'USDC'} size={18} />
              Pay {DEMO_AMOUNT_DISPLAY} {tokenMeta?.symbol ?? 'USDC'}
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
            <li>Connect a wallet that holds USDC on Arc.</li>
            <li>Sign once — Strimz submits the transaction for you.</li>
            <li>USDC settles directly to the merchant.</li>
          </ol>
        </div>
      </div>
    </CheckoutShell>
  )
}

// ---- helpers ----

/**
 * The page collapses the hook's internal phases (idle / signing /
 * submitting / polling / …) plus wallet-connect state into a single
 * visible "what's happening right now" enum. Doing the mapping here
 * keeps `usePayCheckout` focused on the meta-tx flow and the UI
 * focused on rendering.
 */
type VisiblePhase =
  | 'connect'
  | 'ready'
  | 'signing'
  | 'submitting'
  | 'polling'
  | 'confirmed'
  | 'reverted'
  | 'failed'

function derivePhase(
  hookPhase: PayPhase,
  isConnected: boolean,
  tokenMeta: TokenMetadata | null,
): VisiblePhase {
  if (hookPhase === 'confirmed') return 'confirmed'
  if (hookPhase === 'reverted') return 'reverted'
  if (hookPhase === 'failed') return 'failed'
  if (hookPhase === 'signing') return 'signing'
  if (hookPhase === 'submitting') return 'submitting'
  if (hookPhase === 'polling') return 'polling'
  if (!isConnected) return 'connect'
  if (!tokenMeta) return 'connect' // still loading token metadata
  return 'ready'
}

function phaseDescription(phase: VisiblePhase, error: string | null): string {
  switch (phase) {
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

function BusyState({ phase }: { phase: 'signing' | 'submitting' | 'polling' }) {
  const label =
    phase === 'signing'
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
 * Used only while the real token metadata is loading. Has zero
 * capabilities, so any attempt to sign before the real metadata
 * lands will fail loudly in `usePayCheckout.submit()`.
 */
const PLACEHOLDER_TOKEN: TokenMetadata = {
  address: '0x0000000000000000000000000000000000000000',
  name: 'USDC',
  symbol: 'USDC',
  version: '1',
  decimals: 6,
  capabilities: { permit2612: false, transferAuth3009: false },
}
