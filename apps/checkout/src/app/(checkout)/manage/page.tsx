'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAccount, useDisconnect } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'
import { Loader2, ShieldCheck, Wallet } from 'lucide-react'
import { Badge } from '@strimz/ui'
import { SubmitButton } from '@strimz/web-shared/components/auth/submit-button'

import { ConnectedRow } from '@/components/checkout/connected-row'
import { CheckoutPoweredBy } from '@/components/checkout/payment-summary'
import { WalletPickerGuard } from '@/components/checkout/wallet-picker-guard'
import { SelfPayPanel } from '@/components/checkout/self-pay-panel'
import { SubscriptionCard } from '@/components/manage/subscription-card'
import { useManageSubscriptions } from '@/hooks/use-manage-subscriptions'
import { useSelfPay } from '@/hooks/use-self-pay'
import { projectId as reownProjectId } from '@/lib/wagmi'

export default function ManageSubscriptionsPage() {
  return (
    <Suspense fallback={null}>
      <ManageSubscriptions />
    </Suspense>
  )
}

function ManageSubscriptions() {
  const highlight = useSearchParams().get('subscription')
  const { address } = useAccount()
  const { disconnect } = useDisconnect()
  const { open } = useAppKit()
  const { state, signIn, cancel, settleSelfPayCancel, reset } = useManageSubscriptions()
  const selfPay = useSelfPay(state.selfPay?.call ?? null)

  // A different wallet must sign in again; never show the previous wallet's list.
  useEffect(() => {
    reset()
  }, [address, reset])

  const ordered = highlight
    ? [...state.subscriptions].sort(
        (a, b) => Number(b.subscriptionId === highlight) - Number(a.subscriptionId === highlight),
      )
    : state.subscriptions

  return (
    <section className="flex w-full flex-col items-center gap-4 p-4 md:p-8">
      <WalletPickerGuard />
      <div className="w-full max-w-xl space-y-6">
        <div>
          <Badge variant="outline" className="mb-3 gap-1.5">
            <ShieldCheck className="text-brand-text size-3" />
            Secured by Strimz
          </Badge>
          <h1 className="font-poppins text-2xl font-semibold tracking-tight">Your subscriptions</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            See and cancel the subscriptions you pay for with Strimz. Signing in and cancelling cost
            nothing: Strimz pays the network fee.
          </p>
        </div>

        {!address ? (
          <SubmitButton type="button" onClick={() => open()} disabled={!reownProjectId}>
            <Wallet className="size-4" />
            Connect the wallet you subscribed with
          </SubmitButton>
        ) : (
          <>
            <ConnectedRow address={address} onChange={disconnect} label="Signed in as" />

            {state.phase === 'signin' && (
              <div className="space-y-3">
                <p className="text-muted-foreground text-sm">
                  Sign a message in your wallet to prove it&apos;s yours. It doesn&apos;t move any
                  money.
                </p>
                <SubmitButton type="button" onClick={() => void signIn()}>
                  Show my subscriptions
                </SubmitButton>
              </div>
            )}

            {state.phase === 'loading' && (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" />
                Confirm in your wallet, then we&apos;ll load your subscriptions…
              </p>
            )}

            {state.phase === 'empty' && (
              <p className="text-muted-foreground text-sm">
                This wallet has no open subscriptions with Strimz. If you subscribed with another
                wallet, change wallet above.
              </p>
            )}

            {state.phase === 'list' && (
              <ul className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
                {ordered.map((sub) => (
                  <SubscriptionCard
                    key={sub.subscriptionId}
                    sub={sub}
                    highlighted={sub.subscriptionId === highlight}
                    cancelling={state.cancelling === sub.subscriptionId}
                    cancelled={state.cancelled.includes(sub.subscriptionId)}
                    busy={state.cancelling !== null}
                    onCancel={() => void cancel(sub)}
                  />
                ))}
              </ul>
            )}

            {state.selfPay && (
              <SelfPayPanel
                selfPay={selfPay}
                action="Pay the network fee and cancel"
                onSend={() => {
                  const subscriptionId = state.selfPay?.subscriptionId
                  if (!subscriptionId) return
                  void selfPay.send().then((result) => {
                    if (result) void settleSelfPayCancel(subscriptionId, result)
                  })
                }}
              />
            )}

            {state.error && (
              <p role="alert" className="text-danger text-sm">
                {state.error}
              </p>
            )}
          </>
        )}
      </div>
      <CheckoutPoweredBy />
    </section>
  )
}
