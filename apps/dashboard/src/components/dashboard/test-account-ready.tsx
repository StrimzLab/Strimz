'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FlaskConical, Loader2 } from 'lucide-react'
import type { Merchant } from '@strimz/shared-types'
import { Button } from '@strimz/ui'
import { TurnstileWidget } from '@strimz/web-shared/components/shared/turnstile-widget'
import { addedTestNetwork } from '@strimz/web-shared/lib/networks'
import { useMerchantApi } from '@/hooks/api/merchant-api-context'
import { readSignupToken, turnstileSizeFor } from '@/lib/auth-flow'
import { syncSession } from '@/lib/auth-sync'
import { ensureTestAccount } from '@/lib/test-account'
import { useViewportWidth } from '@/components/auth/auth-methods'

type State =
  | { kind: 'working' }
  | { kind: 'needs-check' }
  | { kind: 'error'; message: string }
  | { kind: 'ready' }

/** Creates the merchant's test account from their live one the first time they open Test. */
export function TestAccountReady({
  primary,
  children,
}: {
  primary: Merchant
  children: ReactNode
}) {
  const api = useMerchantApi()
  const queryClient = useQueryClient()
  const viewportWidth = useViewportWidth()
  const [state, setState] = useState<State>({ kind: 'working' })
  const started = useRef(false)

  const run = useCallback(
    async (token: string | null) => {
      const testApiUrl = addedTestNetwork?.apiUrl
      if (!testApiUrl) return setState({ kind: 'ready' })
      setState({ kind: 'working' })
      try {
        const result = await ensureTestAccount({
          primary,
          token,
          retrieve: () => api.merchant.retrieve(),
          sync: (t) => syncSession(t, testApiUrl),
          onboard: (input) => api.merchant.onboard(input),
          acceptTerms: (version) => api.merchant.acceptTerms(version),
        })
        if (result.kind === 'ready') await queryClient.invalidateQueries()
        setState(result)
      } catch (err) {
        setState({ kind: 'error', message: (err as Error).message })
      }
    },
    [api, primary, queryClient],
  )

  useEffect(() => {
    if (started.current) return
    started.current = true
    void run(readSignupToken(undefined, 'test'))
  }, [run])

  if (state.kind === 'ready') return <>{children}</>

  return (
    <div className="flex min-h-[60vh] items-center justify-center py-16">
      <div className="border-border/60 bg-card w-full max-w-md space-y-4 rounded-xl border p-6 text-center">
        <FlaskConical className="text-warning mx-auto size-6" aria-hidden />
        <h2 className="font-sora text-lg font-semibold">
          {state.kind === 'error'
            ? "Your test account isn't ready"
            : 'Setting up your test account'}
        </h2>
        {state.kind === 'working' && (
          <>
            <p className="text-muted-foreground text-sm">
              We&apos;re copying your business details to test mode. This only happens once.
            </p>
            <Loader2 className="text-brand-text mx-auto size-5 animate-spin" aria-label="Working" />
          </>
        )}
        {state.kind === 'needs-check' && (
          <>
            <p className="text-muted-foreground text-sm">
              Confirm you&apos;re not a bot to finish setting up test mode.
            </p>
            <TurnstileWidget
              action="signup"
              resetKey={0}
              size={turnstileSizeFor(viewportWidth)}
              className="flex w-full justify-center py-2"
              onToken={(token) => {
                if (token) void run(token)
              }}
            />
          </>
        )}
        {state.kind === 'error' && (
          <>
            <p className="text-muted-foreground text-sm" role="alert">
              {state.message}
            </p>
            <Button variant="outline" onClick={() => void run(null)}>
              Try again
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
