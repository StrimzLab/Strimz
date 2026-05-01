'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Repeat, ShieldCheck } from 'lucide-react'
import { Badge } from '@strimz/ui'
import { CheckoutShell, StepIndicator } from '@/components/checkout/checkout-shell'
import { SubmitButton } from '@/components/auth/submit-button'

export default function SubscribePage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = use(params)
  const router = useRouter()
  const [step, setStep] = useState<'connect' | 'approve' | 'pay' | 'confirmed'>('connect')

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
          <h2 className="flex items-center gap-2 font-poppins text-2xl font-semibold tracking-tight">
            <Repeat className="size-5 text-[#02C76A]" /> Subscribe
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            One signature, then we charge automatically each month. Cancel anytime from your wallet.
          </p>
        </div>

        {(step === 'approve' || step === 'pay' || step === 'confirmed') && <StepIndicator step={step} />}

        {step === 'connect' && (
          <SubmitButton type="button" onClick={() => setStep('approve')}>Connect wallet</SubmitButton>
        )}
        {step === 'approve' && (
          <SubmitButton type="button" onClick={() => setStep('pay')}>
            Approve 240 USDC (12 months)
          </SubmitButton>
        )}
        {step === 'pay' && (
          <SubmitButton type="button" onClick={() => setStep('confirmed')}>
            Subscribe — 20 USDC/month
          </SubmitButton>
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
