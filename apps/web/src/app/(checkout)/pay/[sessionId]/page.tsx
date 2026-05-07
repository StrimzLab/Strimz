'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Wallet } from 'lucide-react'
import { Badge } from '@strimz/ui'
import { CheckoutShell, StepIndicator } from '@/components/checkout/checkout-shell'
import { SubmitButton } from '@/components/auth/submit-button'

/**
 * Public hosted checkout for one-shot payment sessions.
 *
 * Flow (simplified for the v1 page; real wagmi wiring will live in a
 * `useCheckoutSession` hook once apps/web is integrated with the API):
 *
 *   1. Load session via `GET /v1/payment-sessions/:id`
 *   2. step=connect    — user opens their wallet
 *   3. step=approve    — user approves USDC allowance to the contract
 *   4. step=pay        — user signs the on-chain `pay` call
 *   5. step=confirmed  — show success, optionally redirect to merchant successUrl
 */
export default function PayPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  const router = useRouter()
  const [step, setStep] = useState<'connect' | 'approve' | 'pay' | 'confirmed'>('connect')

  return (
    <CheckoutShell
      summary={{
        merchantName: 'Demo Merchant',
        amount: '50.00',
        currency: 'USDC',
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
          <h2 className="font-poppins text-2xl font-semibold tracking-tight">
            {step === 'confirmed' ? 'Payment confirmed' : 'Pay with USDC'}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {step === 'connect'
              ? 'Connect a wallet to continue. We use Reown AppKit to support every major wallet.'
              : step === 'approve'
                ? 'Approve the contract to use your USDC. One-time per session.'
                : step === 'pay'
                  ? 'Confirm the payment in your wallet.'
                  : `Tx hash recorded · session ${sessionId.slice(0, 12)}…`}
          </p>
        </div>

        {(step === 'approve' || step === 'pay' || step === 'confirmed') && (
          <StepIndicator step={step} />
        )}

        {step === 'connect' && (
          <SubmitButton type="button" onClick={() => setStep('approve')}>
            <Wallet className="size-4" />
            Connect wallet
          </SubmitButton>
        )}
        {step === 'approve' && (
          <SubmitButton type="button" onClick={() => setStep('pay')}>
            Approve 50.00 USDC
          </SubmitButton>
        )}
        {step === 'pay' && (
          <SubmitButton type="button" onClick={() => setStep('confirmed')}>
            Pay 50.00 USDC
          </SubmitButton>
        )}
        {step === 'confirmed' && (
          <div className="rounded-xl border border-[#02C76A]/30 bg-[#02C76A]/5 p-5 text-center text-sm">
            Payment complete. The merchant has been notified via webhook.
          </div>
        )}

        <div className="bg-muted/30 text-muted-foreground rounded-lg p-4 text-xs">
          <p className="text-foreground font-medium">How it works</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Connect a wallet that holds USDC on Arc.</li>
            <li>Approve the Strimz Payments contract (one-time).</li>
            <li>Confirm the payment — USDC settles directly to the merchant.</li>
          </ol>
        </div>
      </div>
    </CheckoutShell>
  )
}
