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

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string
      action?: string
      theme?: 'light' | 'dark' | 'auto'
      callback: (token: string) => void
      'error-callback'?: (errorCode: string) => void
      'expired-callback'?: () => void
      'timeout-callback'?: () => void
    },
  ) => string
  reset: (id?: string) => void
}

function getTurnstile(): TurnstileApi | undefined {
  return (window as unknown as { turnstile?: TurnstileApi }).turnstile
}

export default function SignupPage() {
  const router = useRouter()
  const privy = usePrivyOrNull()
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    if (!env.turnstileSiteKey) return
    // Idempotent script load — guards against StrictMode's double-mount
    // in dev re-running the effect.
    if (document.querySelector('script[data-strimz-turnstile]')) return
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.defer = true
    s.dataset.strimzTurnstile = 'true'
    s.onload = () => {
      const widget = document.getElementById('strimz-turnstile')
      const turnstile = getTurnstile()
      if (widget && turnstile) {
        turnstile.render(widget, {
          sitekey: env.turnstileSiteKey,
          // `action` lets Cloudflare differentiate signup-page tokens
          // from any future Turnstile usage (e.g. contact form) in
          // analytics, and lets the api-side validator confirm the
          // token came from this specific surface.
          action: 'signup',
          theme: 'light',
          callback: (token) => setTurnstileToken(token),
          // Token expired before the user submitted — clear it so the
          // user gets a fresh challenge instead of submitting a stale
          // token the api would reject with timeout-or-duplicate.
          'expired-callback': () => {
            setTurnstileToken(null)
            toast.info('Bot-protection check expired. Please try again.')
          },
          'error-callback': (code) => {
            setTurnstileToken(null)
            // eslint-disable-next-line no-console
            console.warn('[turnstile] error', code)
            toast.error('Bot-protection check failed. Please refresh and try again.')
          },
          'timeout-callback': () => {
            setTurnstileToken(null)
            toast.info('Verification timed out. Please try again.')
          },
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
          getTurnstile()?.reset()
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
      description="Sign up with email, your wallet, or Google. It takes about two minutes."
    >
      {env.turnstileSiteKey ? (
        <div id="strimz-turnstile" className="mb-5 flex justify-center" />
      ) : null}

      <SubmitButton isLoading={verifying} onClick={handleStart} type="button">
        Continue
        <ArrowRight className="size-4" />
      </SubmitButton>

      <p className="font-poppins mt-6 text-center text-sm text-[#58556A]">
        Already have an account?{' '}
        <Link href="/login" className="font-[500] text-[#050020] hover:underline">
          Log in
        </Link>
      </p>

      <p className="font-poppins mt-6 text-center text-xs text-[#58556A]">
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
