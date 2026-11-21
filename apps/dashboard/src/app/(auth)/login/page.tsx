'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AuthCard } from '@/components/auth/auth-card'
import { AuthMethods } from '@/components/auth/auth-methods'
import { UnconfiguredContinueButton } from '@/components/auth/unconfigured-continue-button'
import { safeNextPath, withNext } from '@strimz/web-shared/lib/auth-redirect'
import { env } from '@strimz/web-shared/lib/env'

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
    <AuthCard title="Welcome back" description="Sign in with Google, your email, or a passkey.">
      {env.privyAppId ? <AuthMethods mode="login" next={next} /> : <UnconfiguredContinueButton />}
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
