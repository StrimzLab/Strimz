'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLogin } from '@privy-io/react-auth'
import { toast } from 'sonner'
import { ArrowRight } from 'lucide-react'

import { SubmitButton } from '@/components/auth/submit-button'
import { withNext } from '@/lib/auth-redirect'

export function PrivyContinueButton({ next }: { next: string | null }) {
  const router = useRouter()
  const [opening, setOpening] = useState(false)
  const { login } = useLogin({
    onComplete: () => router.replace(withNext('/callback', next)),
    onError: (error) => {
      setOpening(false)
      if (error === 'exited_auth_flow') return
      toast.error('Sign-in failed. Please try again.')
    },
  })

  return (
    <SubmitButton
      type="button"
      isLoading={opening}
      loadingText="Opening sign-in…"
      onClick={() => {
        setOpening(true)
        login()
      }}
    >
      Continue
      <ArrowRight className="size-4" />
    </SubmitButton>
  )
}

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
