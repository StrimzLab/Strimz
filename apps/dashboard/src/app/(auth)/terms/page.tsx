'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { ArrowRight } from 'lucide-react'
import { TERMS_VERSION } from '@strimz/shared-config'
import { SubmitButton } from '@strimz/web-shared/components/auth/submit-button'
import { safeNextPath, withNext } from '@strimz/web-shared/lib/auth-redirect'

import { AuthCard } from '@/components/auth/auth-card'
import { TermsConsent } from '@/components/auth/terms-consent'
import { useAcceptTerms } from '@/hooks/api/use-merchant'

export default function TermsPage() {
  return (
    <Suspense>
      <Terms />
    </Suspense>
  )
}

function Terms() {
  const router = useRouter()
  const next = safeNextPath(useSearchParams().get('next')) ?? '/app'
  const accept = useAcceptTerms()
  const [agreed, setAgreed] = useState(false)
  const { ready, authenticated } = usePrivy()

  useEffect(() => {
    if (ready && !authenticated) router.replace(withNext('/login', withNext('/terms', next)))
  }, [ready, authenticated, next, router])

  return (
    <AuthCard
      title="We've updated our terms"
      description="Please read and accept them to keep making changes in your dashboard. Payments to your business carry on as normal."
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (!agreed) return
          accept.mutate(TERMS_VERSION, { onSuccess: () => router.replace(next) })
        }}
      >
        <p className="text-muted-foreground text-xs">Version {TERMS_VERSION}</p>
        <TermsConsent checked={agreed} onChange={setAgreed} />
        <SubmitButton
          isLoading={accept.isPending}
          loadingText="Saving…"
          disabled={!agreed || !authenticated}
        >
          Accept and continue
          <ArrowRight className="size-4" />
        </SubmitButton>
      </form>
    </AuthCard>
  )
}
