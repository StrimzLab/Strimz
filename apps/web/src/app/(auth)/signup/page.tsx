'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AuthCard } from '@/components/auth/auth-card'
import {
  PrivyContinueButton,
  UnconfiguredContinueButton,
} from '@/components/auth/privy-continue-button'
import { safeNextPath, withNext } from '@/lib/auth-redirect'
import { env } from '@/lib/env'

export default function SignupPage() {
  return (
    <Suspense>
      <Signup />
    </Suspense>
  )
}

function Signup() {
  const next = safeNextPath(useSearchParams().get('next'))

  return (
    <AuthCard
      title="Create your Strimz account"
      description="Sign up with email, your wallet, or Google. It takes about two minutes."
    >
      {env.privyAppId ? <PrivyContinueButton next={next} /> : <UnconfiguredContinueButton />}

      <p className="font-poppins text-muted-foreground mt-6 text-center text-sm">
        Already have an account?{' '}
        <Link
          href={withNext('/login', next)}
          className="text-foreground font-[500] hover:underline"
        >
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
