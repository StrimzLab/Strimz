'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLogin, usePrivy } from '@privy-io/react-auth'
import { ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { ThemeToggle } from '@strimz/ui'

import { SubmitButton } from '@/components/auth/submit-button'
import { safeNextPath } from '@/lib/auth-redirect'
import { env } from '@/lib/env'

export default function AdminLoginPage() {
  return (
    <div className="bg-background relative flex min-h-screen items-center justify-center p-6">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="border-border/60 bg-card mx-auto w-full max-w-md space-y-4 rounded-xl border p-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="bg-accent inline-block h-2 w-2 rounded-full" />
          <span className="font-display font-semibold">Strimz Admin</span>
        </Link>
        <h1 className="font-sora text-xl font-semibold">Sign in</h1>
        <p className="text-muted-foreground text-sm">
          Use the account your admin access is tied to. Other accounts are turned away.
        </p>
        {env.privyAppId ? (
          <Suspense>
            <AdminSignIn />
          </Suspense>
        ) : (
          <p role="alert" className="text-destructive text-sm">
            Sign-in isn’t configured. Set NEXT_PUBLIC_PRIVY_APP_ID.
          </p>
        )}
      </div>
    </div>
  )
}

function AdminSignIn() {
  const router = useRouter()
  const target = adminTarget(useSearchParams().get('next'))
  const { ready, authenticated } = usePrivy()
  const [opening, setOpening] = useState(false)
  const { login } = useLogin({
    onComplete: () => router.replace(target),
    onError: (error) => {
      setOpening(false)
      if (error === 'exited_auth_flow') return
      toast.error('Sign-in failed. Please try again.')
    },
  })

  useEffect(() => {
    if (ready && authenticated) router.replace(target)
  }, [ready, authenticated, router, target])

  return (
    <SubmitButton
      type="button"
      disabled={!ready || authenticated}
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

function adminTarget(next: string | null): string {
  const path = safeNextPath(next)
  return path &&
    (path === '/admin' || path.startsWith('/admin/')) &&
    !path.startsWith('/admin/login')
    ? path
    : '/admin'
}
