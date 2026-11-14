'use client'

import { use, useEffect, useState } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'
import { formatUnits } from 'viem'
import { CheckCircle2, Loader2, RefreshCcw, ShieldCheck, Wallet } from 'lucide-react'
import { Badge } from '@strimz/ui'
import type { TokenMetadata } from '@strimz/shared-types'

import { CheckoutShell } from '@/components/checkout/checkout-shell'
import { ConnectedRow } from '@/components/checkout/connected-row'
import { WalletPickerGuard } from '@/components/checkout/wallet-picker-guard'
import { SubmitButton } from '@strimz/web-shared/components/auth/submit-button'
import { useAllowanceRenewal, type Renewal } from '@/hooks/use-allowance-renewal'
import { env } from '@strimz/web-shared/lib/env'
import { strimzBrowserClient } from '@/lib/strimz-browser'
import { projectId as reownProjectId } from '@/lib/wagmi'

const RENEWABLE = new Set(['trialing', 'active', 'at_risk'])

export default function RenewAllowancePage({
  params,
}: {
  params: Promise<{ subscriptionId: string }>
}) {
  const { subscriptionId } = use(params)
  const { address } = useAccount()
  const { disconnect } = useDisconnect()
  const { open } = useAppKit()

  const [renewal, setRenewal] = useState<Renewal | null>(null)
  const [token, setToken] = useState<TokenMetadata | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(
          `${env.apiUrl}/v1/checkout/subscriptions/${encodeURIComponent(subscriptionId)}/renewal`,
          { cache: 'no-store' },
        )
        if (!res.ok) throw new Error(`load failed (${res.status})`)
        const data = (await res.json()) as Renewal
        const meta = await strimzBrowserClient().tokens.retrieve(data.token)
        if (cancelled) return
        setRenewal(data)
        setToken(meta)
      } catch (err) {
        if (!cancelled) setLoadError((err as Error).message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [subscriptionId])

  const isPayer = Boolean(
    address && renewal && address.toLowerCase() === renewal.payerAddress.toLowerCase(),
  )
  const { step, error, renew } = useAllowanceRenewal(subscriptionId, renewal, token)
  const amountDisplay =
    renewal && token ? `${formatUnits(BigInt(renewal.amount), token.decimals)} ${token.symbol}` : ''

  return (
    <CheckoutShell
      summary={{
        merchantName: renewal?.merchantName ?? (loadError ? 'Strimz checkout' : undefined),
        merchantLogoUrl: null,
        merchantWalletAddress: null,
        amount: renewal && token ? formatUnits(BigInt(renewal.amount), token.decimals) : undefined,
        currency: token?.symbol ?? renewal?.currency ?? 'USDC',
        description: renewal?.planName,
      }}
      flow="subscribe"
    >
      <WalletPickerGuard />
      <div className="space-y-6">
        <div>
          <Badge variant="outline" className="mb-3 gap-1.5">
            <ShieldCheck className="text-brand-text size-3" />
            Secured by Strimz
          </Badge>
          <h2 className="font-poppins flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <RefreshCcw className="text-brand-text size-5 shrink-0" />
            {step === 'done' ? 'Approval renewed' : 'Renew your approval'}
          </h2>
          {renewal && step !== 'done' && (
            <p className="text-muted-foreground mt-1 text-sm">
              Keep your {renewal.planName} subscription going. Approve once in your wallet; Strimz
              pays the network fee.
            </p>
          )}
        </div>

        {!renewal && !loadError && (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" /> Loading your subscription…
          </div>
        )}

        {loadError && (
          <p className="text-danger text-sm">
            Couldn&apos;t load this subscription. Check the link in your email, or contact the
            merchant.
          </p>
        )}

        {renewal && !RENEWABLE.has(renewal.status) && (
          <p className="text-muted-foreground text-sm">
            This subscription has ended, so there is nothing to renew.
          </p>
        )}

        {renewal && RENEWABLE.has(renewal.status) && step === 'done' && (
          <div className="border-accent/30 bg-accent/5 flex items-start gap-3 rounded-xl border p-5 text-sm">
            <CheckCircle2 className="text-brand-text mt-0.5 size-5 shrink-0" />
            <p>
              Your wallet now approves 12 more charges of {amountDisplay} for {renewal.planName}.
              You can close this window.
            </p>
          </div>
        )}

        {renewal && RENEWABLE.has(renewal.status) && step !== 'done' && (
          <>
            {!address ? (
              <SubmitButton type="button" onClick={() => open()} disabled={!reownProjectId}>
                <Wallet className="size-4" />
                Connect wallet
              </SubmitButton>
            ) : (
              <>
                <ConnectedRow address={address} onChange={disconnect} />
                {!isPayer ? (
                  <p className="text-danger text-sm">
                    This wallet isn&apos;t the wallet that subscribed (
                    {renewal.payerAddress.slice(0, 6)}…{renewal.payerAddress.slice(-4)}). Switch to
                    it to renew.
                  </p>
                ) : (
                  <>
                    <p className="text-muted-foreground text-xs">
                      You&apos;re approving 12 more charges of {amountDisplay}, on top of what your
                      wallet already allows. Nothing is taken until a charge is due.
                    </p>
                    <SubmitButton
                      type="button"
                      onClick={() => void renew()}
                      disabled={step === 'signing' || step === 'submitting' || !token}
                    >
                      {step === 'signing' || step === 'submitting' ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : null}
                      {step === 'signing'
                        ? 'Confirm in your wallet…'
                        : step === 'submitting'
                          ? 'Renewing…'
                          : 'Renew approval'}
                    </SubmitButton>
                  </>
                )}
                {step === 'failed' && error && <p className="text-danger text-sm">{error}</p>}
              </>
            )}
          </>
        )}
      </div>
    </CheckoutShell>
  )
}
