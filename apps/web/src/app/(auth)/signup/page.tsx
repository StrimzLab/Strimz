'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { toast } from 'sonner'
import { ArrowRight } from 'lucide-react'
import { AuthCard } from '@/components/auth/auth-card'
import { SubmitButton } from '@/components/auth/submit-button'
import { env } from '@/lib/env'

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string
          callback: (token: string) => void
          'error-callback'?: () => void
          theme?: 'light' | 'dark' | 'auto'
        },
      ) => string
      reset: (id?: string) => void
    }
  }
}

export default function SignupPage() {
  const router = useRouter()
  const privy = usePrivyOrNull()
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    if (!env.turnstileSiteKey) return
    if (document.querySelector('script[data-strimz-turnstile]')) return
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.defer = true
    s.dataset.strimzTurnstile = 'true'
    s.onload = () => {
      const widget = document.getElementById('strimz-turnstile')
      if (widget && window.turnstile) {
        window.turnstile.render(widget, {
          sitekey: env.turnstileSiteKey,
          callback: (token) => setTurnstileToken(token),
        })
      }
    }
    document.head.appendChild(s)
  }, [])

  async function handleStart() {
    if (env.turnstileSiteKey && !turnstileToken) {
      toast.error('Please complete the bot-protection check')
      return
    }
    setVerifying(true)
    try {
      if (env.turnstileSiteKey && turnstileToken) {
        const r = await fetch(`${env.apiUrl}/v1/auth/turnstile/verify`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: turnstileToken }),
        })
        if (!r.ok) {
          toast.error('Bot protection failed — please try again.')
          window.turnstile?.reset()
          setTurnstileToken(null)
          return
        }
      }
      if (!privy) {
        toast.error('Authentication not configured. Set NEXT_PUBLIC_PRIVY_APP_ID.')
        return
      }
      await privy.login()
      router.push('/auth/callback')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <AuthCard
      title="Create your Strimz account"
      description="Email, wallet, or Google. Two minutes to your API keys."
    >
      {env.turnstileSiteKey ? (
        <div id="strimz-turnstile" className="mb-5 flex justify-center" />
      ) : (
        <p className="mb-5 rounded-md bg-muted/50 p-3 text-center text-xs text-muted-foreground">
          Bot-protection (Turnstile) is disabled in this environment.
        </p>
      )}

      <SubmitButton isLoading={verifying} onClick={handleStart} type="button">
        Continue
        <ArrowRight className="size-4" />
      </SubmitButton>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Log in
        </Link>
      </p>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        By continuing you agree to our{' '}
        <Link href="/legal/terms" className="underline underline-offset-2">Terms</Link>{' '}
        and{' '}
        <Link href="/legal/privacy" className="underline underline-offset-2">Privacy Policy</Link>.
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
