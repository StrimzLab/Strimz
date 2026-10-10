'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { toast } from 'sonner'
import { ArrowRight } from 'lucide-react'
import { AuthCard } from '@/components/auth/auth-card'
import { SubmitButton } from '@/components/auth/submit-button'

export default function SignupPage() {
  const router = useRouter()
  const privy = usePrivyOrNull()
  const [verifying, setVerifying] = useState(false)

  async function handleStart() {
    setVerifying(true)
    try {
      if (!privy) {
        toast.error('Authentication not configured. Set NEXT_PUBLIC_PRIVY_APP_ID.')
        return
      }
      await privy.login()
      // Route group `(auth)` is stripped from the URL, so the callback
      // page lives at `/callback` not `/auth/callback`.
      router.push('/callback')
    } catch (err) {
      // Final safety net so any unexpected error (Privy widget,
      // navigation, etc.) surfaces a toast instead of vanishing.
      console.error('[signup] unexpected error:', err)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <AuthCard
      title="Create your Strimz account"
      description="Sign up with email, your wallet, or Google. It takes about two minutes."
    >
      <SubmitButton isLoading={verifying} onClick={handleStart} type="button">
        Continue
        <ArrowRight className="size-4" />
      </SubmitButton>

      <p className="font-poppins text-muted-foreground mt-6 text-center text-sm">
        Already have an account?{' '}
        <Link href="/login" className="text-foreground font-[500] hover:underline">
          Log in
        </Link>
      </p>

      <p className="font-poppins text-muted-foreground mt-6 text-center text-xs">
        By continuing you agree to our{' '}
        <Link
          href="/legal/terms"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          Terms
        </Link>{' '}
        and{' '}
        <Link
          href="/legal/privacy"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </AuthCard>
  )
}

function usePrivyOrNull() {
  try {
    return usePrivy()
  } catch {
    return null
  }
}
