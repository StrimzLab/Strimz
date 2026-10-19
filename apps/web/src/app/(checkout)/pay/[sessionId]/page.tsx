'use client'

import { use, useEffect, useState } from 'react'
import { useAccount, useBytecode, useDisconnect } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'
import { useRefreshWhile } from '@/hooks/use-refresh-while'
import { Loader2, ShieldCheck, Wallet } from 'lucide-react'
import { getArcChain } from '@strimz/shared-config'
import { Badge, FieldLabel, Input } from '@strimz/ui'
import type { MerchantPublicBrand, PaymentSession, TokenMetadata } from '@strimz/shared-types'

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
import { attachSessionPayer } from '@/lib/checkout-payer'
import { busyLabel, phaseLine } from '@/lib/checkout-copy'
import { attachError, payerError } from '@/lib/payer-errors'
import { usePayCheckout, type PayPhase } from '@/hooks/use-pay-checkout'
import { useCheckoutHost } from '@/hooks/use-checkout-host'
import {
  buildReturnUrl,
  cancelDestination,
  isCancellable,
  isContractAccount,
  resultMessageForPhase,
} from '@/lib/checkout-result'

/**
 * Hosted checkout for one-off payment sessions. A merchant not yet
 * registered with the contract (no chainMerchantId) can't be paid, so
 * the page waits instead of asking for a doomed approval.
 */
export default function PayPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  const { host, report } = useCheckoutHost()

  const { address, isConnected } = useAccount()
  const payerCode = useBytecode({
    address,
    chainId: getArcChain(env.arcEnvironment).id,
    query: { enabled: Boolean(address) },
  })
  const { open } = useAppKit()
  const { disconnect } = useDisconnect()

  const [session, setSession] = useState<PaymentSession | null>(null)
  const [tokenMeta, setTokenMeta] = useState<TokenMetadata | null>(null)
  const [brand, setBrand] = useState<MerchantPublicBrand | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [attaching, setAttaching] = useState(false)
  const [cancelled, setCancelled] = useState(false)

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
  useRefreshWhile(
    session !== null && chainMerchantId === null && loadError === null,
    MERCHANT_READY_POLL_MS,
    () => strimzBrowserClient().checkout.session(sessionId),
    setSession,
    (err) => setLoadError(err.message),
  )
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
    payerIsContract: isContractAccount(payerCode.data),
  })

  const resultTxHash = pay.txHash ?? session?.onchainTxHash ?? null
  const resultError = phase === 'load_error' ? loadError : pay.error
  useEffect(() => {
    const message = resultMessageForPhase({
      phase,
      sessionId,
      txHash: resultTxHash,
      error: resultError,
    })
    if (message) report(message)
  }, [phase, sessionId, resultTxHash, resultError, report])

  // Payers see plain copy; the raw reason stays here for whoever debugs it.
  useEffect(() => {
    if (resultError) console.error('[checkout]', resultError)
  }, [resultError])

  const merchantName = brand?.businessName ?? null
  const symbol = tokenMeta?.symbol ?? session?.currency ?? 'USDC'
  const error =
    phase === 'load_error' || phase === 'reverted' || phase === 'failed'
      ? payerError({
          raw: resultError,
          phase,
          submitted: pay.submission !== null,
          merchantName,
        })
      : null

  const cancel = () => {
    const destination = cancelDestination(host, session?.cancelUrl ?? null, sessionId)
    if (destination) {
      window.location.href = destination
      return
    }
    report({ type: 'strimz:checkout:cancel', sessionId })
    setCancelled(true)
  }

  return (
    <CheckoutShell
      summary={{
        merchantName: brand?.businessName ?? (loadError ? 'Strimz checkout' : undefined),
        merchantLogoUrl: brand?.logoUrl ?? null,
        merchantWalletAddress: brand?.walletAddress ?? null,
        amount: session ? amountDisplay : undefined,
        currency: symbol,
        description: session?.description ?? undefined,
      }}
      onCancel={isCancellable(phase) ? cancel : undefined}
      cancelled={cancelled}
      flow="pay"
    >
      <WalletPickerGuard />
      <div className="space-y-6">
        <div>
          <Badge variant="outline" className="mb-3 gap-1.5">
            <ShieldCheck className="text-accent size-3" />
            Secured by Strimz
          </Badge>
          <h2 className="font-poppins text-2xl font-semibold tracking-tight">
            {phase === 'confirmed'
              ? 'Payment complete'
              : merchantName
                ? `Pay ${merchantName}`
                : 'Checkout'}
          </h2>
          {phaseLine(phase, 'pay') && (
            <p className="text-muted-foreground mt-1 text-sm">{phaseLine(phase, 'pay')}</p>
          )}
        </div>

        {phase !== 'connect' &&
          phase !== 'loading' &&
          phase !== 'load_error' &&
          phase !== 'not_ready' &&
          phase !== 'unsupported_wallet' &&
          phase !== 'confirmed' && <StepIndicator phase={phase} />}

        {phase === 'not_ready' && (
          <CheckoutNotice
            tone="info"
            title={`${merchantName ?? 'This merchant'} can't take payments yet`}
          >
            This page will update by itself.
          </CheckoutNotice>
        )}

        {phase === 'unsupported_wallet' && (
          <>
            {address && <ConnectedRow address={address} onChange={disconnect} />}
            <CheckoutNotice title="This wallet type can't pay here yet">
              Connect a regular wallet such as MetaMask or Coinbase Wallet.
            </CheckoutNotice>
          </>
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
                <p id="payer-email-error" className="text-xs text-red-600 dark:text-red-400">
                  {emailError}
                </p>
              ) : (
                <p className="text-muted-foreground text-xs">We&apos;ll email your receipt here.</p>
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
              disabled={!env.paymentsAddress || attaching || payerCode.isLoading}
            >
              {attaching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <TokenLogo symbol={symbol} size={18} />
              )}
              Pay {amountDisplay} {symbol}
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
          <ReceiptPanel
            title="Payment complete"
            rows={[
              { label: 'Amount', value: `${amountDisplay} ${symbol}` },
              ...(merchantName ? [{ label: 'Paid to', value: merchantName }] : []),
              ...(session?.description ? [{ label: 'For', value: session.description }] : []),
              { label: 'Date', value: receiptDate(session) },
            ]}
            note={session?.payerEmail ? `A receipt is on its way to ${session.payerEmail}.` : null}
            txHash={resultTxHash}
            merchantName={merchantName}
            returnUrl={
              host.mode === 'page' && session?.successUrl
                ? buildReturnUrl(session.successUrl, { sessionId, txHash: resultTxHash })
                : null
            }
            hostMode={host.mode}
          />
        )}

        {error && (
          <PayerErrorNotice
            error={error}
            onRetry={phase === 'load_error' ? undefined : () => void pay.submit()}
          />
        )}

        {phase !== 'confirmed' && <HowItWorks flow="pay" symbol={symbol} />}
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
  | 'unsupported_wallet'
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
  payerIsContract: boolean
}): VisiblePhase {
  const {
    hookPhase,
    isConnected,
    session,
    tokenMeta,
    chainMerchantId,
    loadError,
    payerIsContract,
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
  if (payerIsContract) return 'unsupported_wallet'
  return 'ready'
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

function BusyState({ phase }: { phase: 'loading' | 'signing' | 'submitting' | 'polling' }) {
  return (
    <div className="bg-muted/30 flex items-center gap-3 rounded-md px-3 py-3 text-sm" role="status">
      <Loader2 className="text-accent size-4 animate-spin" />
      <span>{busyLabel(phase)}</span>
    </div>
  )
}

function receiptDate(session: PaymentSession | null): string {
  const at = session?.status === 'confirmed' ? new Date(session.updatedAt) : new Date()
  return at.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Used only while token metadata is still loading. Has zero
 * capabilities so an accidental submission attempt before the real
 * metadata lands fails loudly in `usePayCheckout.submit()`.
 */
const MERCHANT_READY_POLL_MS = 3_000

const PLACEHOLDER_TOKEN: TokenMetadata = {
  address: '0x0000000000000000000000000000000000000000',
  name: 'USDC',
  symbol: 'USDC',
  version: '1',
  decimals: 6,
  capabilities: { permit2612: false, transferAuth3009: false },
}
