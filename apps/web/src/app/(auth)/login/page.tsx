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

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  )
}

function Login() {
  const next = safeNextPath(useSearchParams().get('next'))

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in with the same email, wallet, or social account you used last time."
    >
      {env.privyAppId ? <PrivyContinueButton next={next} /> : <UnconfiguredContinueButton />}
      <p className="font-poppins text-muted-foreground mt-6 text-center text-sm">
        New to Strimz?{' '}
        <Link
          href={withNext('/signup', next)}
          className="text-foreground font-[500] hover:underline"
        >
          Create an account
        </Link>
      </p>
    </AuthCard>
  )
}
