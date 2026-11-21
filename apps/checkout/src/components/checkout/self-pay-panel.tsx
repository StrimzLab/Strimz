'use client'

import { Loader2, Wallet } from 'lucide-react'
import { SubmitButton } from '@strimz/web-shared/components/auth/submit-button'

import { CheckoutNotice } from '@/components/checkout/checkout-notice'
import type { SelfPayState } from '@/hooks/use-self-pay'

export function SelfPayPanel({
  selfPay,
  onSend,
  action = 'Pay the network fee and finish',
}: {
  selfPay: SelfPayState
  onSend: () => void
  action?: string
}) {
  return (
    <div className="space-y-3">
      <CheckoutNotice tone="info" title="Strimz can't cover the network fee for this one">
        <p>
          You can pay it from your wallet.{' '}
          {selfPay.fee ? `The network fee is ${selfPay.fee}.` : 'Working out the network fee…'}
        </p>
        <p className="mt-1">You won&apos;t need to approve the payment again.</p>
      </CheckoutNotice>
      <SubmitButton type="button" onClick={onSend} disabled={selfPay.sending}>
        {selfPay.sending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Wallet className="size-4" />
        )}
        {selfPay.sending ? 'Waiting for the network…' : action}
      </SubmitButton>
      {selfPay.error && (
        <p role="alert" className="text-danger text-center text-xs">
          {selfPay.error}
        </p>
      )}
    </div>
  )
}
