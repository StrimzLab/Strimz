'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useDisconnect } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'
import { Repeat, ShieldCheck, Wallet } from 'lucide-react'
import { Badge } from '@strimz/ui'
import { CheckoutShell, StepIndicator } from '@/components/checkout/checkout-shell'
import { SubmitButton } from '@/components/auth/submit-button'
import { TokenLogo } from '@/components/shared/token-logo'
import { projectId as reownProjectId } from '@/lib/wagmi'

export default function SubscribePage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = use(params)
  const router = useRouter()
  const [step, setStep] = useState<'connect' | 'approve' | 'pay' | 'confirmed'>('connect')

  const { address, isConnected } = useAccount()
  const { open } = useAppKit()
  const { disconnect } = useDisconnect()

  // Auto-advance once a wallet is connected — same pattern as `/pay/...`.
  useEffect(() => {
    if (isConnected && step === 'connect') setStep('approve')
  }, [isConnected, step])

  return (
    <CheckoutShell
      summary={{
        merchantName: 'Demo Merchant',
        amount: '20.00',
        currency: 'USDC',
        interval: 'monthly',
        description: `Plan ${planId}`,
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
            <Repeat className="size-5 text-[#02C76A]" /> Subscribe
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            One signature, then we charge automatically each month. Cancel anytime from your wallet.
          </p>
        </div>

        {(step === 'approve' || step === 'pay' || step === 'confirmed') && (
          <StepIndicator phase={legacyStepToPhase(step)} />
        )}

        {step === 'connect' && (
          <>
            {!reownProjectId ? (
              <div className="font-poppins rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700">
                Wallet connect is unavailable — set <code>NEXT_PUBLIC_REOWN_PROJECT_ID</code>.
              </div>
            ) : null}
            <SubmitButton type="button" onClick={() => open()} disabled={!reownProjectId}>
              <Wallet className="size-4" />
              Connect wallet
            </SubmitButton>
          </>
        )}

        {step === 'approve' && (
          <>
            {address ? <ConnectedRow address={address} onChange={disconnect} /> : null}
            <SubmitButton type="button" onClick={() => setStep('pay')}>
              <TokenLogo symbol="USDC" size={18} />
              Approve 240 USDC (12 months)
            </SubmitButton>
          </>
        )}

        {step === 'pay' && (
          <>
            {address ? <ConnectedRow address={address} onChange={disconnect} /> : null}
            <SubmitButton type="button" onClick={() => setStep('confirmed')}>
              <TokenLogo symbol="USDC" size={18} />
              Subscribe — 20 USDC/month
            </SubmitButton>
          </>
        )}

        {step === 'confirmed' && (
          <div className="rounded-xl border border-[#02C76A]/30 bg-[#02C76A]/5 p-5 text-center text-sm">
            Subscription active. Your first charge has been recorded on-chain.
          </div>
        )}
      </div>
    </CheckoutShell>
  )
}

/**
 * Bridge the legacy `step` union to the new `phase` indicator until
 * the subscription flow is rewired to EIP-2612 (tracked as a follow-up
 * to Task #55). `approve` predates the collapse and maps to `ready`;
 * `pay` maps to the in-flight `submitting`; `confirmed` stays as-is.
 */
function legacyStepToPhase(
  step: 'connect' | 'approve' | 'pay' | 'confirmed',
): 'ready' | 'submitting' | 'confirmed' | 'connect' {
  if (step === 'approve') return 'ready'
  if (step === 'pay') return 'submitting'
  if (step === 'confirmed') return 'confirmed'
  return 'connect'
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
