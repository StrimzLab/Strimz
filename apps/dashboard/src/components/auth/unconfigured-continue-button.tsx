'use client'

import { toast } from 'sonner'
import { ArrowRight } from 'lucide-react'

import { SubmitButton } from '@strimz/web-shared/components/auth/submit-button'

export function UnconfiguredContinueButton() {
  return (
    <SubmitButton
      type="button"
      onClick={() => toast.error('Authentication not configured. Set NEXT_PUBLIC_PRIVY_APP_ID.')}
    >
      Continue
      <ArrowRight className="size-4" />
    </SubmitButton>
  )
}
