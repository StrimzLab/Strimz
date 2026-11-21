'use client'

import { useEffect, useState } from 'react'
import { useLoginWithEmail } from '@privy-io/react-auth'
import { ArrowRight } from 'lucide-react'
import { FieldLabel, Input } from '@strimz/ui'
import { SubmitButton } from '@strimz/web-shared/components/auth/submit-button'

import { authErrorMessage, normaliseCode } from '@/lib/auth-flow'

const RESEND_SECONDS = 30
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u

export function EmailCodeForm({ mode, ready }: { mode: 'signup' | 'login'; ready: boolean }) {
  const { sendCode, loginWithCode, state } = useLoginWithEmail()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  const sending = state.status === 'sending-code'
  const checking = state.status === 'submitting-code'

  async function send() {
    const address = email.trim()
    if (!EMAIL.test(address)) {
      setError('Enter a valid email address.')
      return
    }
    setError(null)
    try {
      await sendCode({ email: address, disableSignup: mode === 'login' })
      setStep('code')
      setCode('')
      setCooldown(RESEND_SECONDS)
    } catch (err) {
      console.error('[auth] sending the code failed', err)
      setError(authErrorMessage(err, 'send'))
    }
  }

  async function check(value: string) {
    if (value.length !== 6) return
    setError(null)
    try {
      await loginWithCode({ code: value })
    } catch (err) {
      console.error('[auth] checking the code failed', err)
      setCode('')
      setError(authErrorMessage(err, 'code'))
    }
  }

  if (step === 'code') {
    return (
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void check(code)
        }}
      >
        <p className="text-muted-foreground text-sm">
          We sent a 6-digit code to <span className="text-foreground font-medium">{email}</span>. It
          expires in 10 minutes.
        </p>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="auth-code" required>
            Code
          </FieldLabel>
          <Input
            id="auth-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="123456"
            value={code}
            disabled={checking}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'auth-code-error' : undefined}
            onChange={(e) => {
              const next = normaliseCode(e.target.value)
              setCode(next)
              if (next.length === 6) void check(next)
            }}
          />
        </div>
        <SubmitButton isLoading={checking} loadingText="Checking…" disabled={code.length !== 6}>
          Continue
          <ArrowRight className="size-4" />
        </SubmitButton>
        {error && (
          <p id="auth-code-error" role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
        <div className="text-muted-foreground flex justify-between text-sm">
          <button
            type="button"
            className="hover:text-foreground"
            onClick={() => {
              setStep('email')
              setError(null)
            }}
          >
            Use another email
          </button>
          <button
            type="button"
            className="hover:text-foreground disabled:opacity-50"
            disabled={cooldown > 0 || sending}
            onClick={() => void send()}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </button>
        </div>
      </form>
    )
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        void send()
      }}
    >
      <div className="space-y-1.5">
        <FieldLabel htmlFor="auth-email" required>
          Email
        </FieldLabel>
        <Input
          id="auth-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@business.com"
          value={email}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'auth-email-error' : undefined}
          onChange={(e) => {
            setEmail(e.target.value)
            if (error) setError(null)
          }}
        />
      </div>
      <SubmitButton isLoading={sending} loadingText="Sending code…" disabled={!ready}>
        Continue with email
        <ArrowRight className="size-4" />
      </SubmitButton>
      {error && (
        <p id="auth-email-error" role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
    </form>
  )
}
