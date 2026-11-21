'use client'

import { useState, useSyncExternalStore } from 'react'
import { useLoginWithOAuth, useLoginWithPasskey } from '@privy-io/react-auth'
import { KeyRound } from 'lucide-react'
import { Button } from '@strimz/ui'

import { authErrorMessage } from '@/lib/auth-flow'

const never = () => () => {}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.4v2.8h3.7c2.2-2 3.4-5 3.4-8.4Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.8c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v2.9A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.6 14.8a7.2 7.2 0 0 1 0-4.6V7.3H1.8a12 12 0 0 0 0 10.4l3.8-2.9Z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3A12 12 0 0 0 1.8 7.3l3.8 2.9C6.5 7.4 9 4.8 12 4.8Z"
      />
    </svg>
  )
}

export function GoogleButton({ mode, ready }: { mode: 'signup' | 'login'; ready: boolean }) {
  const [error, setError] = useState<string | null>(null)
  // After Google sends the person back, failures arrive here rather than from initOAuth.
  const { initOAuth, loading } = useLoginWithOAuth({
    onError: (code) => setError(authErrorMessage({ privyErrorCode: code }, 'google')),
  })

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="h-10 w-full gap-2"
        disabled={!ready || loading}
        onClick={() => {
          setError(null)
          initOAuth({ provider: 'google', disableSignup: mode === 'login' }).catch(
            (err: unknown) => {
              console.error('[auth] google sign-in failed', err)
              setError(authErrorMessage(err, 'google'))
            },
          )
        }}
      >
        <GoogleMark />
        {loading ? 'Opening Google…' : 'Continue with Google'}
      </Button>
      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
    </div>
  )
}

export function PasskeyButton({ ready }: { ready: boolean }) {
  const supported = useSyncExternalStore(
    never,
    () => typeof window.PublicKeyCredential !== 'undefined',
    () => false,
  )
  const { loginWithPasskey, state } = useLoginWithPasskey()
  const [error, setError] = useState<string | null>(null)

  if (!supported) return null
  const busy = state.status !== 'initial' && state.status !== 'error' && state.status !== 'done'

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="h-10 w-full gap-2"
        disabled={!ready || busy}
        onClick={() => {
          setError(null)
          loginWithPasskey().catch((err: unknown) => {
            console.error('[auth] passkey sign-in failed', err)
            setError(authErrorMessage(err, 'passkey'))
          })
        }}
      >
        <KeyRound className="size-4" />
        {busy ? 'Waiting for your passkey…' : 'Sign in with a passkey'}
      </Button>
      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
    </div>
  )
}
