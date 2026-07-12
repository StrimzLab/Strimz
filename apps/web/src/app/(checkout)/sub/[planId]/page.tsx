'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useDisconnect } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'
import { Loader2, Repeat, ShieldCheck, Wallet } from 'lucide-react'
import { Badge, FieldLabel, Input } from '@strimz/ui'
import type { MerchantPublicBrand, SubscriptionPlan, TokenMetadata } from '@strimz/shared-types'

import { CheckoutShell, StepIndicator } from '@/components/checkout/checkout-shell'
import { WalletPickerGuard } from '@/components/checkout/wallet-picker-guard'
import { SubmitButton } from '@/components/auth/submit-button'
import { TokenLogo } from '@/components/shared/token-logo'
import { projectId as reownProjectId } from '@/lib/wagmi'
import { env } from '@/lib/env'
import { strimzBrowserClient } from '@/lib/strimz-browser'
import { attachPlanPayer } from '@/lib/checkout-payer'
import { useSubscriptionCheckout, type SubscriptionPhase } from '@/hooks/use-subscription-checkout'

/**
 * Public hosted checkout for subscription enrolment.
 *
 * Loads the plan payload (amount, currency, intervalSeconds,
 * tokenAddress, chainMerchantId), looks up token capabilities, then
 * drives the EIP-2612 single-signature flow via
 * `useSubscriptionCheckout`. A plan whose merchant isn't yet
 * registered on-chain (chainMerchantId == null) surfaces a clear
 * error rather than letting the payer attempt a doomed signature.
 */
export default function SubscribePage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = use(params)
  const router = useRouter()

  const { address, isConnected } = useAccount()
  const { open } = useAppKit()
  const { disconnect } = useDisconnect()

  const [plan, setPlan] = useState<SubscriptionPlan | null>(null)
  const [tokenMeta, setTokenMeta] = useState<TokenMetadata | null>(null)
  const [brand, setBrand] = useState<MerchantPublicBrand | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [attaching, setAttaching] = useState(false)
  const [existingSub, setExistingSub] = useState<{
    active: boolean
    subscriptionId: string | null
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const p = await strimzBrowserClient().checkout.plan(planId)
        if (cancelled) return
        setPlan(p)
        void strimzBrowserClient()
          .checkout.merchant(p.merchantId)
          .then((b) => {
            if (!cancelled) setBrand(b)
          })
          .catch(() => {})
        if (!p.tokenAddress) {
          throw new Error('plan has no token address configured. Set ARC_USDC_ADDRESS on the API')
        }
        const meta = await strimzBrowserClient().tokens.retrieve(p.tokenAddress)
        if (!cancelled) setTokenMeta(meta)
      } catch (err) {
        if (!cancelled) setLoadError((err as Error).message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [planId])

  // On connect, flag an existing subscription so we show "already subscribed"
  // instead of enrolling a duplicate. The relay enforces this server-side too,
  // so a failed check just falls through to the normal flow.
  useEffect(() => {
    if (!address) {
      setExistingSub(null)
      return
    }
    let cancelled = false
    void strimzBrowserClient()
      .checkout.subscriptionStatus(planId, address)
      .then((r) => {
        if (!cancelled) setExistingSub(r)
      })
      .catch(() => {
        if (!cancelled) setExistingSub(null)
      })
    return () => {
      cancelled = true
    }
  }, [planId, address])

  const chainMerchantId = plan?.chainMerchantId ?? null
  const amountBaseUnits = plan ? BigInt(plan.amount) : 0n
  const amountDisplay = formatAmount(amountBaseUnits, tokenMeta?.decimals ?? 6)
  const intervalSeconds = plan?.intervalSeconds ?? 0
  const intervalLabel = humaniseInterval(plan?.interval ?? null)

  const subscribe = useSubscriptionCheckout({
    sessionId: planId,
    merchantId: chainMerchantId ? BigInt(chainMerchantId) : 0n,
    tokenMeta: tokenMeta ?? PLACEHOLDER_TOKEN,
    amount: amountBaseUnits,
    intervalSeconds: intervalSeconds || 1, // hook validates > 0; 1 keeps it from throwing while loading
  })

  const phase = derivePhase({
    hookPhase: subscribe.phase,
    isConnected,
    plan,
    tokenMeta,
    chainMerchantId,
    intervalSeconds,
    loadError,
    alreadySubscribed: existingSub?.active ?? false,
  })

  return (
    <CheckoutShell
      summary={{
        merchantName: brand?.businessName,
        merchantLogoUrl: brand?.logoUrl ?? null,
        merchantWalletAddress: brand?.walletAddress ?? null,
        amount: amountDisplay,
        currency: tokenMeta?.symbol ?? plan?.currency ?? 'USDC',
        interval: plan?.interval ?? 'monthly',
        description: plan?.description ?? `Plan ${planId}`,
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
            <Repeat className="size-5 text-[#02C76A]" />
            {phase === 'confirmed'
              ? 'Subscription active'
              : phase === 'already_subscribed'
                ? 'Already subscribed'
                : 'Subscribe'}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {phaseDescription(phase, subscribe.error)}
          </p>
        </div>

        {phase !== 'connect' &&
          phase !== 'loading' &&
          phase !== 'load_error' &&
          phase !== 'not_ready' &&
          phase !== 'already_subscribed' && <StepIndicator phase={phase} />}

        {phase === 'load_error' && <ErrorBanner message={loadError ?? 'Failed to load plan.'} />}

        {phase === 'not_ready' && (
          <ErrorBanner
            message={
              'This merchant has not been registered on-chain yet. Subscriptions will be available once Strimz completes their on-chain enrolment.'
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

        {phase === 'ready' && (
          <>
            {address && <ConnectedRow address={address} onChange={disconnect} />}
            <div className="space-y-1.5">
              <FieldLabel htmlFor="payer-email" required>
                Email for receipts
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
                  We send an enrolment receipt now and one for each renewal.
                </p>
              )}
            </div>
            <SubmitButton
              type="button"
              onClick={() =>
                void handleSubscribeClick({
                  email,
                  address,
                  planId,
                  setEmailError,
                  setAttaching,
                  onReady: () => void subscribe.submit(),
                })
              }
              disabled={!env.subscriptionsAddress || attaching}
            >
              {attaching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <TokenLogo symbol={tokenMeta?.symbol ?? 'USDC'} size={18} />
              )}
              Subscribe. {amountDisplay} {tokenMeta?.symbol ?? 'USDC'}/{intervalLabel}
            </SubmitButton>
          </>
        )}

        {phase === 'already_subscribed' && (
          <>
            {address && <ConnectedRow address={address} onChange={disconnect} />}
            <div className="rounded-xl border border-[#02C76A]/30 bg-[#02C76A]/5 p-5 text-sm">
              <p className="text-foreground font-medium">
                This wallet is already subscribed to this plan
              </p>
              <p className="text-muted-foreground mt-2 text-xs">
                {`It already has an active subscription to ${plan?.name ?? 'this plan'}, so there is nothing to pay again. To subscribe from a different wallet, use Change above.`}
              </p>
            </div>
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
            <p className="text-foreground font-medium">Subscription active</p>
            {subscribe.txHash && (
              <p className="text-muted-foreground mt-1 break-all font-mono text-xs">
                {subscribe.txHash}
              </p>
            )}
            <p className="text-muted-foreground mt-2 text-xs">
              Your first charge has been recorded on-chain. Strimz will charge automatically each
              period. Cancel anytime.
            </p>
          </div>
        )}

        {(phase === 'reverted' || phase === 'failed') && (
          <ErrorBanner
            message={subscribe.error ?? 'The subscription enrolment did not go through.'}
            retry={subscribe.submit}
          />
        )}

        <div className="bg-muted/30 text-muted-foreground rounded-lg p-4 text-xs">
          <p className="text-foreground font-medium">How it works</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Connect a wallet that holds {tokenMeta?.symbol ?? 'USDC'} on Arc.</li>
            <li>Sign once. Strimz creates the subscription on-chain.</li>
            <li>Strimz settles each scheduled charge automatically.</li>
          </ol>
        </div>
      </div>
    </CheckoutShell>
  )
}

// ---- helpers ----

async function handleSubscribeClick(args: {
  email: string
  address: string | undefined
  planId: string
  setEmailError: (v: string | null) => void
  setAttaching: (v: boolean) => void
  onReady: () => void
}): Promise<void> {
  const trimmed = args.email.trim()
  if (!isValidEmail(trimmed)) {
    args.setEmailError('Enter a valid email address so we can send your receipts.')
    return
  }
  if (!args.address) {
    args.setEmailError('Reconnect your wallet and try again.')
    return
  }
  args.setAttaching(true)
  try {
    await attachPlanPayer({
      planId: args.planId,
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
  | 'ready'
  | 'already_subscribed'
  | 'signing'
  | 'submitting'
  | 'polling'
  | 'confirmed'
  | 'reverted'
  | 'failed'

function derivePhase(args: {
  hookPhase: SubscriptionPhase
  isConnected: boolean
  plan: SubscriptionPlan | null
  tokenMeta: TokenMetadata | null
  chainMerchantId: string | null
  intervalSeconds: number
  loadError: string | null
  alreadySubscribed: boolean
}): VisiblePhase {
  const {
    hookPhase,
    isConnected,
    plan,
    tokenMeta,
    chainMerchantId,
    intervalSeconds,
    loadError,
    alreadySubscribed,
  } = args
  if (loadError) return 'load_error'
  if (!plan || !tokenMeta || intervalSeconds <= 0) return 'loading'
  if (!chainMerchantId) return 'not_ready'
  if (hookPhase === 'confirmed') return 'confirmed'
  if (hookPhase === 'reverted') return 'reverted'
  if (hookPhase === 'failed') return 'failed'
  if (hookPhase === 'signing') return 'signing'
  if (hookPhase === 'submitting') return 'submitting'
  if (hookPhase === 'polling') return 'polling'
  if (!isConnected) return 'connect'
  if (alreadySubscribed) return 'already_subscribed'
  return 'ready'
}

function phaseDescription(phase: VisiblePhase, error: string | null): string {
  switch (phase) {
    case 'loading':
      return 'Loading plan…'
    case 'load_error':
      return 'We could not load this subscription plan.'
    case 'not_ready':
      return ''
    case 'connect':
      return 'Connect a wallet to continue. We use Reown AppKit to support every major wallet.'
    case 'ready':
      return 'One signature, then we charge automatically each period. Cancel anytime from your wallet.'
    case 'already_subscribed':
      return ''
    case 'signing':
      return 'Confirm the signature in your wallet.'
    case 'submitting':
      return 'Creating your subscription on-chain…'
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
 * string. `50000000` at 6 decimals → `"50.00"`. Uses string slicing
 * so uint256 values don't risk Number truncation.
 */
function formatAmount(baseUnits: bigint, decimals: number): string {
  if (baseUnits === 0n) return '0.00'
  const s = baseUnits.toString().padStart(decimals + 1, '0')
  const whole = s.slice(0, -decimals)
  const frac = s.slice(-decimals).replace(/0+$/, '')
  return frac ? `${whole}.${frac}` : `${whole}.00`
}

function humaniseInterval(interval: SubscriptionPlan['interval'] | null): string {
  switch (interval) {
    case 'daily':
      return 'day'
    case 'weekly':
      return 'week'
    case 'monthly':
      return 'month'
    case 'quarterly':
      return 'quarter'
    case 'yearly':
      return 'year'
    default:
      return 'period'
  }
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

const PLACEHOLDER_TOKEN: TokenMetadata = {
  address: '0x0000000000000000000000000000000000000000',
  name: 'USDC',
  symbol: 'USDC',
  version: '1',
  decimals: 6,
  capabilities: { permit2612: false, transferAuth3009: false },
}
