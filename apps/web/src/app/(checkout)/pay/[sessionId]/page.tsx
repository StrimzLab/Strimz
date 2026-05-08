'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useDisconnect } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'
import { ShieldCheck, Wallet } from 'lucide-react'
import { Badge } from '@strimz/ui'
import { CheckoutShell, StepIndicator } from '@/components/checkout/checkout-shell'
import { SubmitButton } from '@/components/auth/submit-button'
import { projectId as reownProjectId } from '@/lib/wagmi'

/**
 * Public hosted checkout for one-shot payment sessions.
 *
 * Flow (simplified for the v1 page; real wagmi tx logic will live in a
 * `useCheckoutSession` hook once apps/web is integrated with the API):
 *
 *   1. Load session via `GET /v1/payment-sessions/:id`
 *   2. step=connect    — payer opens AppKit modal, picks a wallet
 *   3. step=approve    — payer approves USDC allowance to the contract
 *   4. step=pay        — payer signs the on-chain `pay` call
 *   5. step=confirmed  — show success, optionally redirect to merchant successUrl
 *
 * Wallet connection uses Reown AppKit. The `useAccount` hook tracks the
 * connected address; once it appears we auto-advance from `connect`
 * to `approve`.
 */
export default function PayPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  const router = useRouter()
  const [step, setStep] = useState<'connect' | 'approve' | 'pay' | 'confirmed'>('connect')

  const { address, isConnected } = useAccount()
  const { open } = useAppKit()
  const { disconnect } = useDisconnect()

  // Auto-advance once a wallet is connected. Doing this here rather
  // than from a connect-success callback keeps the state machine
  // single-sourced — `isConnected` is the wagmi store's truth.
  useEffect(() => {
    if (isConnected && step === 'connect') setStep('approve')
  }, [isConnected, step])

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
              Approve 50.00 USDC
            </SubmitButton>
          </>
        )}

        {step === 'pay' && (
          <>
            {address ? <ConnectedRow address={address} onChange={disconnect} /> : null}
            <SubmitButton type="button" onClick={() => setStep('confirmed')}>
              Pay 50.00 USDC
            </SubmitButton>
          </>
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
