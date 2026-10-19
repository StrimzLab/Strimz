'use client'

import { use, useCallback, useEffect, useState } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'
import { useRefreshWhile } from '@/hooks/use-refresh-while'
import { trialCopy } from '@/lib/subscription-trial'
import { isCancellable } from '@/lib/checkout-result'
import { Loader2, Repeat, ShieldCheck, Wallet } from 'lucide-react'
import { Badge, FieldLabel, Input } from '@strimz/ui'
import type {
  MerchantPublicBrand,
  SubscriptionEnrolmentTerms,
  SubscriptionPlan,
  TokenMetadata,
} from '@strimz/shared-types'

import { CheckoutShell, StepIndicator } from '@/components/checkout/checkout-shell'
import {
  CheckoutNotice,
  PayerErrorNotice,
  WalletConnectUnavailable,
} from '@/components/checkout/checkout-notice'
import { ConnectedRow } from '@/components/checkout/connected-row'
import { HowItWorks } from '@/components/checkout/how-it-works'
import { ReceiptPanel } from '@/components/checkout/receipt-panel'
import { WalletPickerGuard } from '@/components/checkout/wallet-picker-guard'
import { SubmitButton } from '@/components/auth/submit-button'
import { TokenLogo } from '@/components/shared/token-logo'
import { projectId as reownProjectId } from '@/lib/wagmi'
import { env } from '@/lib/env'
import { strimzBrowserClient } from '@/lib/strimz-browser'
import { attachPlanPayer } from '@/lib/checkout-payer'
import { busyLabel, intervalLabel, phaseLine } from '@/lib/checkout-copy'
import { attachError, payerError } from '@/lib/payer-errors'
import { useSubscriptionCheckout, type SubscriptionPhase } from '@/hooks/use-subscription-checkout'

/**
 * Hosted checkout for subscriptions. A merchant not yet registered with
 * the contract (no chainMerchantId) can't take one, so the page waits
 * instead of asking for a doomed approval.
 */
export default function SubscribePage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = use(params)

  const { address, isConnected } = useAccount()
  const { open } = useAppKit()
  const { disconnect } = useDisconnect()

  const [plan, setPlan] = useState<SubscriptionPlan | null>(null)
  const [tokenMeta, setTokenMeta] = useState<TokenMetadata | null>(null)
  const [brand, setBrand] = useState<MerchantPublicBrand | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [terms, setTerms] = useState<SubscriptionEnrolmentTerms | null>(null)
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [attaching, setAttaching] = useState(false)
  const [cancelled, setCancelled] = useState(false)
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

  useEffect(() => {
    if (!address) {
      setTerms(null)
      return
    }
    let cancelled = false
    void strimzBrowserClient()
      .checkout.planTerms(planId, address)
      .then((t) => {
        if (!cancelled) setTerms(t)
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError((err as Error).message)
      })
    return () => {
      cancelled = true
    }
  }, [planId, address])

  const resolveStartAt = useCallback(async () => {
    if (!address) throw new Error('wallet not connected')
    const fresh = await strimzBrowserClient().checkout.planTerms(planId, address)
    setTerms(fresh)
    return BigInt(fresh.startAt)
  }, [planId, address])

  const chainMerchantId = plan?.chainMerchantId ?? null
  useRefreshWhile(
    plan !== null && chainMerchantId === null && loadError === null,
    MERCHANT_READY_POLL_MS,
    () => strimzBrowserClient().checkout.plan(planId),
    setPlan,
    (err) => setLoadError(err.message),
  )
  const amountBaseUnits = plan ? BigInt(plan.amount) : 0n
  const amountDisplay = formatAmount(amountBaseUnits, tokenMeta?.decimals ?? 6)
  const intervalSeconds = plan?.intervalSeconds ?? 0
  const interval = intervalLabel(plan?.interval)

  const subscribe = useSubscriptionCheckout({
    sessionId: planId,
    merchantId: chainMerchantId ? BigInt(chainMerchantId) : 0n,
    tokenMeta: tokenMeta ?? PLACEHOLDER_TOKEN,
    amount: amountBaseUnits,
    intervalSeconds: intervalSeconds || 1, // hook validates > 0; 1 keeps it from throwing while loading
    resolveStartAt,
  })
  const symbol = tokenMeta?.symbol ?? plan?.currency ?? 'USDC'
  const copy = terms ? trialCopy(terms, `${amountDisplay} ${symbol}`, interval) : null

  const phase = derivePhase({
    hookPhase: subscribe.phase,
    isConnected,
    plan,
    tokenMeta,
    chainMerchantId,
    intervalSeconds,
    loadError,
    alreadySubscribed: existingSub?.active ?? false,
    termsReady: terms !== null,
  })

  const rawError = phase === 'load_error' ? loadError : subscribe.error
  // Payers see plain copy; the raw reason stays here for whoever debugs it.
  useEffect(() => {
    if (rawError) console.error('[checkout]', rawError)
  }, [rawError])

  const merchantName = brand?.businessName ?? null
  const error =
    phase === 'load_error' || phase === 'reverted' || phase === 'failed'
      ? payerError({
          raw: rawError,
          phase,
          submitted: subscribe.submission !== null,
          merchantName,
        })
      : null

  return (
    <CheckoutShell
      summary={{
        merchantName: brand?.businessName ?? (loadError ? 'Strimz checkout' : undefined),
        merchantLogoUrl: brand?.logoUrl ?? null,
        merchantWalletAddress: brand?.walletAddress ?? null,
        amount: plan ? amountDisplay : undefined,
        currency: symbol,
        interval: plan?.interval,
        description: plan?.description ?? plan?.name,
      }}
      onCancel={isCancellable(phase) ? () => setCancelled(true) : undefined}
      cancelled={cancelled}
      flow="subscribe"
    >
      <WalletPickerGuard />
      <div className="space-y-6">
        <div>
          <Badge variant="outline" className="mb-3 gap-1.5">
            <ShieldCheck className="text-accent size-3" />
            Secured by Strimz
          </Badge>
          <h2 className="font-poppins flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Repeat className="text-accent size-5 shrink-0" />
            {phase === 'confirmed'
              ? 'Subscription active'
              : phase === 'already_subscribed'
                ? 'Already subscribed'
                : plan?.name
                  ? `Subscribe to ${plan.name}`
                  : 'Subscribe'}
          </h2>
          {phaseLine(phase, 'subscribe') && (
            <p className="text-muted-foreground mt-1 text-sm">{phaseLine(phase, 'subscribe')}</p>
          )}
        </div>

        {phase !== 'connect' &&
          phase !== 'loading' &&
          phase !== 'load_error' &&
          phase !== 'not_ready' &&
          phase !== 'already_subscribed' &&
          phase !== 'confirmed' && <StepIndicator phase={phase} />}

        {phase === 'not_ready' && (
          <CheckoutNotice
            tone="info"
            title={`${merchantName ?? 'This merchant'} can't take subscriptions yet`}
          >
            This page will update by itself.
          </CheckoutNotice>
        )}

        {phase === 'loading' && <BusyState phase="loading" />}

        {phase === 'connect' && (
          <>
            {!reownProjectId && <WalletConnectUnavailable />}
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
                <p id="payer-email-error" className="text-xs text-red-600 dark:text-red-400">
                  {emailError}
                </p>
              ) : (
                <p className="text-muted-foreground text-xs">
                  We&apos;ll email a receipt for every charge.
                </p>
              )}
            </div>
            {copy && <p className="text-foreground text-sm">{copy.notice}</p>}
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
                <TokenLogo symbol={symbol} size={18} />
              )}
              {copy?.button ?? `Subscribe for ${amountDisplay} ${symbol} / ${interval}`}
            </SubmitButton>
          </>
        )}

        {phase === 'already_subscribed' && (
          <>
            {address && <ConnectedRow address={address} onChange={disconnect} />}
            <div className="border-accent/30 bg-accent/5 rounded-xl border p-5 text-sm">
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
          <ReceiptPanel
            title="Subscription active"
            rows={[
              { label: 'Plan', value: plan?.name ?? 'Subscription' },
              { label: 'Price', value: `${amountDisplay} ${symbol} / ${interval}` },
              ...(merchantName ? [{ label: 'Paid to', value: merchantName }] : []),
              {
                label: 'Date',
                value: new Date().toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }),
              },
            ]}
            note={copy?.confirmed ?? null}
            txHash={subscribe.txHash}
            merchantName={merchantName}
            returnUrl={null}
            hostMode="page"
          />
        )}

        {error && <PayerErrorNotice error={error} onRetry={() => void subscribe.submit()} />}

        {phase !== 'confirmed' && phase !== 'already_subscribed' && (
          <HowItWorks flow="subscribe" symbol={symbol} />
        )}
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
    args.setEmailError(attachError((err as Error).message))
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
  termsReady: boolean
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
    termsReady,
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
  if (!termsReady) return 'loading'
  return 'ready'
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

function BusyState({ phase }: { phase: 'loading' | 'signing' | 'submitting' | 'polling' }) {
  return (
    <div className="bg-muted/30 flex items-center gap-3 rounded-md px-3 py-3 text-sm" role="status">
      <Loader2 className="text-accent size-4 animate-spin" />
      <span>{busyLabel(phase)}</span>
    </div>
  )
}

const MERCHANT_READY_POLL_MS = 3_000

const PLACEHOLDER_TOKEN: TokenMetadata = {
  address: '0x0000000000000000000000000000000000000000',
  name: 'USDC',
  symbol: 'USDC',
  version: '1',
  decimals: 6,
  capabilities: { permit2612: false, transferAuth3009: false },
}
